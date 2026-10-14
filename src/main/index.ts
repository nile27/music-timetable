import path from 'node:path';
import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { IPC } from '../shared/ipc-channels';
import type { Track } from '../shared/types';
import { getDefaultCoverDir, getMusicDir } from './app-paths';
import { MusicLibrary } from './library';
import { handleMediaProtocol, registerMediaScheme, setMediaRoots } from './media-protocol';

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

function registerIpcHandlers(library: MusicLibrary, musicDir: string): void {
  // 무엇을 틀지는 메인이 정한다 (판단은 main, 소리는 renderer).
  // 2단계: 목록의 첫 곡. 다음 곡 번호 계산은 3단계 스케줄러에서 한다.
  ipcMain.on(IPC.PLAYER_REQUEST_PLAY, (event) => {
    const first = library.getTracks()[0];
    if (!first) {
      console.warn('[player] 재생할 곡이 없습니다');
      return;
    }
    const track: Track = { title: first.title, url: first.url };
    event.sender.send(IPC.PLAYER_PLAY, track);
  });
  ipcMain.on(IPC.PLAYER_REQUEST_STOP, (event) => {
    event.sender.send(IPC.PLAYER_STOP);
  });

  ipcMain.handle(IPC.LIBRARY_LIST, () => library.getTracks());
  ipcMain.handle(IPC.LIBRARY_ADD, (_event, paths: unknown) => library.addFiles(toPathList(paths)));
  ipcMain.on(IPC.LIBRARY_OPEN_FOLDER, () => {
    void shell.openPath(musicDir).then((error) => {
      if (error) console.warn(`[library] 폴더를 열지 못했습니다: ${error}`);
    });
  });
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

  const library = new MusicLibrary(musicDir, defaultCoverDir, (tracks) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(IPC.LIBRARY_CHANGED, tracks);
    }
  });
  // 음악 폴더를 먼저 만들어야 realpath로 허용 폴더를 정할 수 있다.
  await library.start();
  await setMediaRoots({ music: [musicDir], defaultCovers: [defaultCoverDir] });
  handleMediaProtocol();
  registerIpcHandlers(library, musicDir);
  createWindow();

  app.on('will-quit', () => library.stop());
});

// X를 누르면 바로 종료한다 (트레이·종료 확인 없음). macOS도 개발 확인을 위해 같게 맞춘다.
app.on('window-all-closed', () => {
  app.quit();
});
