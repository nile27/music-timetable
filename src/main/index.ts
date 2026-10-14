import path from 'node:path';
import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { IPC } from '../shared/ipc-channels';
import { normalizeSchedule, validateSchedule } from '../shared/schedule';
import type { SaveScheduleResult, ScheduleSlot } from '../shared/types';
import { getDefaultCoverDir, getMusicDir } from './app-paths';
import { MusicLibrary } from './library';
import { handleMediaProtocol, registerMediaScheme, setMediaRoots } from './media-protocol';
import { Scheduler } from './scheduler';
import { SettingsStore } from './settings';
import { parseVolume } from './settings-rules';

// electron-builder.yml의 appId와 같아야 Windows 작업 표시줄·알림에서 같은 앱으로 묶인다.
const APP_USER_MODEL_ID = 'com.music-timetable.app';
const WINDOW_WIDTH = 960;
const WINDOW_HEIGHT = 640;

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      // 보안 기본값을 명시해 둔다. 바꾸지 말 것 (CLAUDE.md 금지 사항).
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      // 등교 시간에는 아무도 클릭하지 않으므로 사용자 조작 없이도 소리가 나야 한다.
      autoplayPolicy: 'no-user-gesture-required',
    },
  });

  window.on('ready-to-show', () => window.show());

  // 오프라인 앱이라 새 창·외부 페이지 이동은 모두 막는다.
  // 파일을 창 밖 엉뚱한 곳에 떨어뜨려도 그 파일로 이동하지 않게 하는 역할도 한다.
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());

  const devServerUrl = process.env['ELECTRON_RENDERER_URL'];
  if (!app.isPackaged && devServerUrl) {
    void window.loadURL(devServerUrl);
  } else {
    void window.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
  return window;
}

/** 화면에서 온 값은 믿지 않는다: 문자열 배열인지 확인한다. */
function toPathList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

interface AppServices {
  library: MusicLibrary;
  settings: SettingsStore;
  scheduler: Scheduler;
  musicDir: string;
}

function registerIpcHandlers({ library, settings, scheduler, musicDir }: AppServices): void {
  // 무엇을 틀지는 메인(스케줄러)이 정한다 (판단은 main, 소리는 renderer).
  ipcMain.on(IPC.PLAYER_REQUEST_PLAY, () => scheduler.requestPlay());
  ipcMain.on(IPC.PLAYER_REQUEST_STOP, () => scheduler.requestStop());
  ipcMain.on(IPC.PLAYER_ENDED, (_event, trackId: unknown) => scheduler.handleEnded(trackId));
  ipcMain.on(IPC.PLAYER_ERROR, (_event, trackId: unknown) => scheduler.handleError(trackId));
  ipcMain.handle(IPC.STATUS_GET, () => scheduler.getStatus());

  ipcMain.handle(IPC.SETTINGS_GET, () => settings.get());
  ipcMain.handle(IPC.SETTINGS_SAVE, async (_event, value: unknown): Promise<SaveScheduleResult> => {
    // 화면에서도 검사하지만 메인이 다시 검사한다 (화면에서 온 값은 믿지 않는다).
    const schedule = Array.isArray(value) ? parseScheduleInput(value) : null;
    if (!schedule) return { ok: false, issues: [] };
    const issues = validateSchedule(schedule);
    if (issues.length > 0) return { ok: false, issues };
    await settings.save({ schedule: normalizeSchedule(schedule) });
    console.info('[settings] 시간표 저장', JSON.stringify(settings.get().schedule));
    // 바뀐 시간표로 바로 판정해 화면 상태를 갱신한다 (다음 1초를 기다리지 않음).
    scheduler.tick();
    return { ok: true, settings: settings.get() };
  });
  ipcMain.on(IPC.SETTINGS_SET_VOLUME, (_event, value: unknown) => {
    const volume = parseVolume(value);
    if (volume !== null) void settings.save({ volume });
  });

  ipcMain.handle(IPC.LIBRARY_LIST, () => library.getTracks());
  ipcMain.handle(IPC.LIBRARY_ADD, (_event, paths: unknown) => library.addFiles(toPathList(paths)));
  ipcMain.on(IPC.LIBRARY_OPEN_FOLDER, () => {
    void shell.openPath(musicDir).then((error) => {
      if (error) console.warn(`[library] 폴더를 열지 못했습니다: ${error}`);
    });
  });
}

/** 화면에서 온 시간표 배열을 ScheduleSlot[]로. 항목 형식이 틀리면 null. */
function parseScheduleInput(value: unknown[]): ScheduleSlot[] | null {
  const slots: ScheduleSlot[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) return null;
    const { name, start, end } = item as Record<string, unknown>;
    if (typeof name !== 'string' || typeof start !== 'string' || typeof end !== 'string') {
      return null;
    }
    slots.push({ name, start, end });
  }
  return slots;
}

function sendToWindows(channel: string, payload?: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(channel, payload);
  }
}

registerMediaScheme();

void app.whenReady().then(async () => {
  if (process.platform === 'win32') {
    // 개발 실행은 electron.exe라서 실행 파일 경로를 ID로 써야 알림 등이 동작한다.
    app.setAppUserModelId(app.isPackaged ? APP_USER_MODEL_ID : process.execPath);
  }

  const musicDir = getMusicDir();
  const defaultCoverDir = getDefaultCoverDir();
  // "내 음악"이 OneDrive 등으로 옮겨진 PC가 있어 실제 위치를 남긴다. (5단계에서 electron-log로 옮김)
  console.info(`[app] 음악 폴더: ${musicDir}`);
  console.info(`[app] 기본 커버 폴더: ${defaultCoverDir}`);

  const settings = new SettingsStore(path.join(app.getPath('userData'), 'settings.json'));
  await settings.load();

  const library = new MusicLibrary(musicDir, defaultCoverDir, (tracks) =>
    sendToWindows(IPC.LIBRARY_CHANGED, tracks),
  );
  // 음악 폴더를 먼저 만들어야 realpath로 허용 폴더를 정할 수 있다.
  await library.start();
  await setMediaRoots({ music: [musicDir], defaultCovers: [defaultCoverDir] });
  handleMediaProtocol();

  const scheduler = new Scheduler({
    getTracks: () => library.getTracks(),
    getSettings: () => settings.get(),
    saveNextIndex: (nextIndex) => void settings.save({ nextIndex }),
    play: (track) => sendToWindows(IPC.PLAYER_PLAY, track),
    stop: () => sendToWindows(IPC.PLAYER_STOP),
    publishStatus: (status) => sendToWindows(IPC.STATUS_UPDATE, status),
  });
  registerIpcHandlers({ library, settings, scheduler, musicDir });

  const window = createWindow();
  // 화면이 다 뜬 뒤에 판정을 시작해야 재생 지시가 허공으로 사라지지 않는다.
  // 화면이 다시 로드되면(개발 중 새로고침 등) 소리가 끊기므로 상태를 맞추고 다시 판정한다.
  window.webContents.on('did-finish-load', () => scheduler.resync());

  app.on('will-quit', () => {
    scheduler.stop();
    library.stop();
  });
});

// X를 누르면 바로 종료한다 (트레이·종료 확인 없음). macOS도 개발 확인을 위해 같게 맞춘다.
app.on('window-all-closed', () => {
  app.quit();
});
