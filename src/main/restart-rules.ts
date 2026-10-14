// 새벽 자동 재시작 판단 (NFR-03). 몇 주씩 켜 두는 앱이라 메모리 누수 등에 대비해 하루 한 번 새로 시작한다.
// 특정 시각 알람이 아니라 매번 "지금 재시작해도 되는가"를 계산하는 순수 함수로 둔다.
import { findActiveSlot } from '../shared/schedule';
import type { ScheduleSlot } from '../shared/types';

/** 재시작 시각 03:00. 03:00~04:00 사이에만 시도하고, 계속 재생 중이면 그날은 건너뛴다. */
export const RESTART_HOUR = 3;
const RESTART_WINDOW_HOURS = 1;

export interface RestartCheck {
  now: Date;
  /** 이 앱이 시작된 시각. 재시작 직후 또 재시작하는 무한 반복을 막는 데 쓴다. */
  startedAt: Date;
  schedule: readonly ScheduleSlot[];
  /** 지금 소리를 내지 않는 중인지 (수동 재생 포함). */
  isIdle: boolean;
}

export function shouldRestart({ now, startedAt, schedule, isIdle }: RestartCheck): boolean {
  const windowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), RESTART_HOUR);
  const windowEnd = new Date(windowStart.getTime() + RESTART_WINDOW_HOURS * 60 * 60 * 1000);
  const isInWindow = now >= windowStart && now < windowEnd;
  // 오늘 03:00 이후에 켜진 앱(= 방금 재시작한 앱 포함)은 이미 "새로 시작된" 상태다.
  const isStartedBeforeWindow = startedAt < windowStart;
  // 재생 구간 안이면 소리가 안 나는 중이어도(정지 버튼 등) 끊지 않는다.
  const isOutsideSlot = findActiveSlot(schedule, now) === null;
  return isInWindow && isStartedBeforeWindow && isIdle && isOutsideSlot;
}
