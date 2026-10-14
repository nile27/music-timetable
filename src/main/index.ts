import path from 'node:path';
import { app, BrowserWindow, ipcMain } from 'electron';
import { IPC } from '../shared/ipc-channels';
import { handleMediaProtocol, registerMediaScheme, setAllowedMediaRoots } from './media-protocol';
import { findTestTrack } from './test-track';

// electron-builder.yml의 appId와 같아야 Windows 작업 표시줄·알림에서 같은 앱으로 묶인다.
const APP_USER_MODEL_ID = 'com.music-timetable.app';
const WINDOW_WIDTH = 960;
const WINDOW_HEIGHT = 640;

// 1단계: 개발 중에는 프로젝트의 music/ 폴더를 쓴다. 2단계에서 사용자 음악 폴더로 바꾼다.
const MUSIC_DIR = path.join(app.getAppPath(), 'music');

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

function registerIpcHandlers(): void {
  // 무엇을 틀지는 메인이 정한다 (판단은 main, 소리는 renderer).
  ipcMain.on(IPC.PLAYER_REQUEST_PLAY, async (event) => {
    const track = await findTestTrack(MUSIC_DIR);
    if (track) event.sender.send(IPC.PLAYER_PLAY, track);
  });
  ipcMain.on(IPC.PLAYER_REQUEST_STOP, (event) => {
    event.sender.send(IPC.PLAYER_STOP);
  });
}

registerMediaScheme();

void app.whenReady().then(async () => {
  if (process.platform === 'win32') {
    // 개발 실행은 electron.exe라서 실행 파일 경로를 ID로 써야 알림 등이 동작한다.
    app.setAppUserModelId(app.isPackaged ? APP_USER_MODEL_ID : process.execPath);
  }

  await setAllowedMediaRoots([MUSIC_DIR]);
  handleMediaProtocol();
  registerIpcHandlers();
  createWindow();
});

// X를 누르면 바로 종료한다 (트레이·종료 확인 없음). macOS도 개발 확인을 위해 같게 맞춘다.
app.on('window-all-closed', () => {
  app.quit();
});
