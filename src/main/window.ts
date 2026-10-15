// 메인 창. 트레이 없이 최소화(–)로 숨기고, X는 바로 종료한다 (FR-30·34).
import path from 'node:path';
import { app, BrowserWindow } from 'electron';
import { logger } from './logger';

const WINDOW_WIDTH = 960;
const WINDOW_HEIGHT = 640;

export function createMainWindow(options: { startMinimized: boolean }): BrowserWindow {
  const window = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    show: false,
    autoHideMenuBar: true,
    // 창이 뜨는 순간 흰 화면이 번쩍이지 않게 앱 바탕색과 맞춘다.
    backgroundColor: '#0B0C11',
    // 디자인처럼 배경을 창 맨 위까지 채운다. Windows에서는 최소화·닫기 버튼만 오른쪽 위(140×32)에 남긴다.
    // macOS(개발용)는 왼쪽 위 신호등 버튼이 그대로 보인다.
    titleBarStyle: 'hidden',
    ...(process.platform === 'darwin'
      ? {}
      : { titleBarOverlay: { color: '#00000000', symbolColor: '#FFFFFF', height: 32 } }),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      // 보안 기본값을 명시해 둔다. 바꾸지 말 것 (CLAUDE.md 금지 사항).
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      // 등교 시간에는 아무도 클릭하지 않으므로 사용자 조작 없이도 소리가 나야 한다.
      autoplayPolicy: 'no-user-gesture-required',
      // 최소화·가려진 창에서도 화면 쪽 타이머·오디오 이벤트가 느려지지 않게 한다 (곡 끝 알림 지연 방지).
      backgroundThrottling: false,
    },
  });

  window.on('ready-to-show', () => {
    // PC 로그인 때 자동 실행되면 화면을 가리지 않도록 작업 표시줄에만 띄운다.
    if (options.startMinimized) {
      window.minimize();
    } else {
      window.show();
    }
  });

  // 오프라인 앱이라 새 창·외부 페이지 이동은 모두 막는다.
  // 파일을 창 밖 엉뚱한 곳에 떨어뜨려도 그 파일로 이동하지 않게 하는 역할도 한다.
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());

  // 화면 프로세스가 죽으면 소리도 멈춘다. 다시 로드하면 스케줄러가 재판정해서 구간 안이면 다시 튼다.
  window.webContents.on('render-process-gone', (_event, details) => {
    logger.error(`[window] 화면 프로세스 종료: ${details.reason} (exitCode ${details.exitCode})`);
    if (details.reason !== 'clean-exit' && !window.isDestroyed()) window.reload();
  });
  window.on('unresponsive', () => logger.warn('[window] 화면이 응답하지 않습니다'));

  const devServerUrl = process.env['ELECTRON_RENDERER_URL'];
  if (!app.isPackaged && devServerUrl) {
    void window.loadURL(devServerUrl);
  } else {
    void window.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
  return window;
}

/** 두 번째 실행·작업 표시줄 클릭 등으로 창을 다시 보여줄 때. */
export function revealWindow(window: BrowserWindow): void {
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}
