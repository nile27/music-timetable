// 무인 운영을 위한 시스템 기능: 자동 실행, 새벽 재시작 (FR-31, NFR-03).
import { app } from 'electron';
import type { ScheduleSlot } from '../shared/types';
import { logger } from './logger';
import { shouldRestart } from './restart-rules';

/** 로그인 자동 실행으로 켜졌다는 표시. 이때는 창을 최소화로 시작한다. */
export const AUTOSTART_ARG = '--autostart';

export function isLaunchedAtLogin(): boolean {
  return process.argv.includes(AUTOSTART_ARG);
}

/**
 * PC 켜질 때 자동 실행 (FR-31). 개발 실행에서는 electron 실행 파일이 시작 프로그램에
 * 등록되어 버리므로 배포판에서만 적용한다.
 */
export function applyAutoLaunch(isEnabled: boolean): void {
  if (!app.isPackaged) {
    logger.info(`[system] 자동 실행 ${isEnabled ? '켜기' : '끄기'} (개발 실행이라 등록하지 않음)`);
    return;
  }
  app.setLoginItemSettings({ openAtLogin: isEnabled, args: [AUTOSTART_ARG] });
  logger.info(`[system] 자동 실행 ${isEnabled ? '켜짐' : '꺼짐'}`);
}

// 재시작 조건은 1시간 창(03:00~04:00) 안에서만 맞으므로 30초마다 봐도 충분하다.
const RESTART_CHECK_INTERVAL_MS = 30_000;

export interface RestartWatcherDeps {
  getSchedule: () => readonly ScheduleSlot[];
  isIdle: () => boolean;
  /** 재시작 직전 정리 (설정 저장 마무리 등). */
  beforeRestart: () => Promise<void>;
}

/** 새벽 03:00 자동 재시작 (NFR-03). 재생 중이거나 재생 구간이면 그날은 건너뛴다. */
export function startRestartWatcher(deps: RestartWatcherDeps): () => void {
  const startedAt = new Date();
  let isRestarting = false;

  const timer = setInterval(() => {
    if (isRestarting) return;
    const now = new Date();
    if (!shouldRestart({ now, startedAt, schedule: deps.getSchedule(), isIdle: deps.isIdle() })) {
      return;
    }
    isRestarting = true;
    if (!app.isPackaged) {
      // 개발 실행은 electron-vite가 띄운 프로세스라 다시 켜면 개발 서버와 끊긴다.
      logger.info('[system] 새벽 재시작 시각 (개발 실행이라 건너뜀)');
      return;
    }
    logger.info('[system] 새벽 재시작');
    void deps.beforeRestart().finally(() => {
      // 새벽에 창이 화면을 가리지 않도록 최소화로 다시 시작한다.
      const args = process.argv.slice(1).filter((arg) => arg !== AUTOSTART_ARG);
      app.relaunch({ args: [...args, AUTOSTART_ARG] });
      app.exit(0);
    });
  }, RESTART_CHECK_INTERVAL_MS);

  return () => clearInterval(timer);
}
