// 앱 시작·종료. 각 기능은 모듈에 있고 여기서는 순서대로 연결만 한다.
import path from 'node:path';
import { app, BrowserWindow } from 'electron';
import { IPC } from '../shared/ipc-channels';
import { getDefaultCoverDir, getMusicDir } from './app-paths';
import { bundledHolidayProvider, toHolidayMap } from './holiday-provider';
import { registerIpcHandlers } from './ipc';
import { MusicLibrary } from './library';
import { repairNextTrackId } from './library-rules';
import { logger } from './logger';
import { handleMediaProtocol, registerMediaScheme, setMediaRoots } from './media-protocol';
import { Scheduler } from './scheduler';
import { SettingsStore } from './settings';
import { migrateNextIndex } from './settings-rules';
import { applyAutoLaunch, isLaunchedAtLogin, startRestartWatcher } from './system';
import { createMainWindow, revealWindow } from './window';

// electron-builder.yml의 appId와 같아야 Windows 작업 표시줄·알림에서 같은 앱으로 묶인다.
const APP_USER_MODEL_ID = 'com.music-timetable.app';

function sendToWindows(channel: string, payload?: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(channel, payload);
  }
}

// 예상 못 한 오류도 로그에 남겨야 무인 운영 중 멈춘 원인을 찾을 수 있다.
process.on('uncaughtException', (error) => logger.error('[app] 처리되지 않은 예외', error));
process.on('unhandledRejection', (reason) =>
  logger.error('[app] 처리되지 않은 Promise 거부', reason),
);

async function startApp(): Promise<void> {
  if (process.platform === 'win32') {
    // 개발 실행은 electron.exe라서 실행 파일 경로를 ID로 써야 알림 등이 동작한다.
    app.setAppUserModelId(app.isPackaged ? APP_USER_MODEL_ID : process.execPath);
  }

  const musicDir = getMusicDir();
  const defaultCoverDir = getDefaultCoverDir();
  logger.info(`[app] 시작 v${app.getVersion()}${isLaunchedAtLogin() ? ' (자동 실행)' : ''}`);
  // "내 음악"이 OneDrive 등으로 옮겨진 PC가 있어 실제 위치를 남긴다.
  logger.info(`[app] 음악 폴더: ${musicDir}`);
  logger.info(`[app] 기본 커버 폴더: ${defaultCoverDir}`);
  logger.info(`[app] 로그 파일: ${logger.getFilePath()}`);

  const settings = new SettingsStore(path.join(app.getPath('userData'), 'settings.json'));
  await settings.load();
  applyAutoLaunch(settings.get().autoLaunch);

  const library = new MusicLibrary({
    musicDir,
    defaultCoverDir,
    getOrder: () => settings.get().trackOrder,
    saveOrder: (trackOrder) => void settings.save({ trackOrder }),
    onChange: (tracks, previous) => {
      // 다음 곡이 지워졌으면(앱의 휴지통 버튼이든 탐색기든) 그 아래 곡으로 넘긴다.
      const { nextTrackId } = settings.get();
      const repaired = repairNextTrackId(
        nextTrackId,
        previous.map((track) => track.id),
        tracks.map((track) => track.id),
      );
      if (repaired !== nextTrackId) void settings.save({ nextTrackId: repaired });
      sendToWindows(IPC.LIBRARY_CHANGED, tracks);
    },
  });
  // 음악 폴더를 먼저 만들어야 realpath로 허용 폴더를 정할 수 있다.
  await library.start();
  const legacyNextIndex = settings.takeLegacyNextIndex();
  if (legacyNextIndex !== null) {
    // 1.0.0은 이름순 번호로 저장했다. 첫 읽기 결과가 이름순이므로 같은 곡을 찾을 수 있다.
    const ids = library.getTracks().map((track) => track.id);
    await settings.save({ nextTrackId: migrateNextIndex(legacyNextIndex, ids) });
  }
  await setMediaRoots({ music: [musicDir], defaultCovers: [defaultCoverDir] });
  handleMediaProtocol();

  const { data: holidayData, droppedCount } = await bundledHolidayProvider();
  if (droppedCount > 0)
    logger.warn(`[holiday] 형식이 틀린 공휴일 ${droppedCount}개를 제외했습니다`);
  logger.info(
    `[holiday] 공휴일 ${holidayData.holidays.length}개, 수록 연도: ${holidayData.years.join(', ')}`,
  );
  if (!holidayData.years.includes(new Date().getFullYear())) {
    // 수록 연도가 지나면 공휴일에도 재생된다. 앱 업데이트가 필요하다는 신호.
    logger.warn('[holiday] 올해 공휴일 정보가 없습니다. 앱 업데이트가 필요합니다');
  }
  const holidayMap = toHolidayMap(holidayData);

  const scheduler = new Scheduler({
    getTracks: () => library.getTracks(),
    getSettings: () => settings.get(),
    getHolidays: () => holidayMap,
    saveNextTrackId: (nextTrackId) => void settings.save({ nextTrackId }),
    play: (track) => sendToWindows(IPC.PLAYER_PLAY, track),
    stop: () => sendToWindows(IPC.PLAYER_STOP),
    publishStatus: (status) => sendToWindows(IPC.STATUS_UPDATE, status),
  });
  registerIpcHandlers({ library, settings, scheduler, holidayData, musicDir });

  const window = createMainWindow({ startMinimized: isLaunchedAtLogin() });
  // 화면이 다 뜬 뒤에 판정을 시작해야 재생 지시가 허공으로 사라지지 않는다.
  // 화면이 다시 로드되면(새로고침·화면 프로세스 재시작) 소리가 끊기므로 상태를 맞추고 다시 판정한다.
  window.webContents.on('did-finish-load', () => scheduler.resync());

  // 이미 실행 중인데 아이콘을 또 누르면 새로 켜지 않고 기존 창을 앞으로 (음악이 두 번 나오지 않게).
  app.on('second-instance', () => {
    logger.info('[app] 중복 실행 시도 → 기존 창 표시');
    if (!window.isDestroyed()) revealWindow(window);
  });

  const stopRestartWatcher = startRestartWatcher({
    getSchedule: () => settings.get().schedule,
    isIdle: () => scheduler.isIdle(),
    beforeRestart: async () => {
      scheduler.stop();
      library.stop();
      await settings.flush();
    },
  });

  // X → 창이 닫히면(window-all-closed) 종료 → 여기서 정리. 재생 위치는 곡 시작 때 이미 저장되어 있고,
  // 아직 쓰는 중인 설정이 있으면 끝날 때까지 기다렸다가 종료한다 (FR-34).
  let isCleanedUp = false;
  app.on('before-quit', (event) => {
    if (isCleanedUp) return;
    event.preventDefault();
    stopRestartWatcher();
    scheduler.stop();
    library.stop();
    void settings.flush().finally(() => {
      isCleanedUp = true;
      logger.info('[app] 종료');
      app.quit();
    });
  });
}

// 중복 실행 방지: 두 번째 실행은 첫 번째에 알리고(second-instance) 바로 끝낸다.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  registerMediaScheme();
  void app
    .whenReady()
    .then(startApp)
    .catch((error: unknown) => {
      logger.error('[app] 시작 실패', error);
    });

  // X를 누르면 바로 종료한다 (트레이·종료 확인 없음). macOS도 개발 확인을 위해 같게 맞춘다.
  app.on('window-all-closed', () => app.quit());
}
