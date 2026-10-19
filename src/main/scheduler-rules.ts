// 스케줄러 판정 규칙. "지금 재생해야 하는가"를 매초 다시 계산하는 상태 판정 방식이라
// 늦게 켜진 경우(FR-06)·날짜 변경·PC 시계 변경을 따로 처리하지 않아도 된다.
// Electron·타이머를 모르는 순수 함수로 두어 시각을 바꿔가며 테스트한다.
import type { PlayMode } from '../shared/types';

/**
 * 구간 식별자. 날짜를 포함해서 "오늘 점심"과 "내일 점심"을 다른 구간으로 본다.
 * 구간 밖이면 null.
 */
export type SlotKey = string | null;

export function toSlotKey(dateKey: string, slot: { start: string; end: string } | null): SlotKey {
  return slot ? `${dateKey} ${slot.start}-${slot.end}` : null;
}

export interface SchedulerState {
  mode: PlayMode;
  /** 재생 중인 구간 (mode가 playing일 때). */
  playingSlotKey: SlotKey;
  /** [정지]를 눌러 이번에는 다시 틀지 않을 구간. 그 구간이 끝나면 풀린다. */
  suppressedSlotKey: SlotKey;
}

export const INITIAL_SCHEDULER_STATE: SchedulerState = {
  mode: 'idle',
  playingSlotKey: null,
  suppressedSlotKey: null,
};

/** 실행할 동작. start = 다음 곡(nextTrackId)부터 재생 시작, stop = 즉시 정지. */
export type SchedulerAction = 'start' | 'stop' | 'none';

export interface Decision {
  state: SchedulerState;
  action: SchedulerAction;
}

/** 매초 판정. activeSlotKey는 지금 시각이 속한 구간 (휴무일 판단은 4단계에서 여기 앞에 붙는다). */
export function decideTick(
  state: SchedulerState,
  activeSlotKey: SlotKey,
  hasTracks: boolean,
): Decision {
  // 정지로 막아 둔 구간이 끝났으면 막음을 푼다.
  const suppressedSlotKey =
    state.suppressedSlotKey === activeSlotKey ? state.suppressedSlotKey : null;
  const base = { ...state, suppressedSlotKey };

  switch (state.mode) {
    case 'playing':
      if (activeSlotKey === null) {
        // 구간 종료: 곡 중간이라도 즉시 정지 (FR-03).
        return { state: { ...base, mode: 'idle', playingSlotKey: null }, action: 'stop' };
      }
      // 붙어 있는 다음 구간으로 바로 넘어간 경우는 끊지 않고 이어서 재생한다.
      return { state: { ...base, playingSlotKey: activeSlotKey }, action: 'none' };

    case 'manual':
      // 수동 재생 중 구간이 시작되면 스케줄 재생으로 넘긴다 → 그 구간이 끝날 때 정지된다.
      if (activeSlotKey !== null) {
        return {
          state: { ...base, mode: 'playing', playingSlotKey: activeSlotKey },
          action: 'none',
        };
      }
      return { state: base, action: 'none' };

    case 'idle':
      if (activeSlotKey !== null && activeSlotKey !== suppressedSlotKey && hasTracks) {
        return {
          state: { ...base, mode: 'playing', playingSlotKey: activeSlotKey },
          action: 'start',
        };
      }
      return { state: base, action: 'none' };
  }
}

/** [재생] 버튼. 구간 안이면 스케줄 재생, 밖이면 수동 재생 (정지 버튼을 누를 때까지). */
export function decideManualPlay(
  state: SchedulerState,
  activeSlotKey: SlotKey,
  hasTracks: boolean,
): Decision {
  if (state.mode !== 'idle' || !hasTracks) return { state, action: 'none' };
  return {
    state:
      activeSlotKey !== null
        ? { mode: 'playing', playingSlotKey: activeSlotKey, suppressedSlotKey: null }
        : { mode: 'manual', playingSlotKey: null, suppressedSlotKey: null },
    action: 'start',
  };
}

/**
 * [정지] 버튼, 또는 모든 곡이 재생에 실패해서 포기할 때.
 * 구간 안이었다면 그 구간이 끝날 때까지 다시 틀지 않는다 (매초 판정이 바로 다시 켜지 않게).
 */
export function decideStop(state: SchedulerState, activeSlotKey: SlotKey): Decision {
  return {
    state: { mode: 'idle', playingSlotKey: null, suppressedSlotKey: activeSlotKey },
    action: state.mode === 'idle' ? 'none' : 'stop',
  };
}

/**
 * 노래 목록에서 곡을 두 번 눌렀다. 직접 고른 것이므로 [정지]로 막아 둔 구간이어도 바로 그 곡을 튼다.
 * 정지 상태면 [재생] 버튼과 같다 (구간 안이면 스케줄 재생, 밖이면 수동 재생).
 * 이미 재생 중이면 모드는 그대로 두고 곡만 바꾼다.
 */
export function decidePlayTrack(state: SchedulerState, activeSlotKey: SlotKey): Decision {
  if (state.mode !== 'idle') return { state, action: 'start' };
  return decideManualPlay(state, activeSlotKey, true);
}

/** 다음에 틀 곡의 위치. 저장된 곡이 목록에 없으면(처음 실행, 지워진 곡) 맨 위 곡부터. */
export function findTrackIndex(trackIds: readonly string[], nextTrackId: string | null): number {
  const index = nextTrackId === null ? -1 : trackIds.indexOf(nextTrackId);
  return index === -1 ? 0 : index;
}

/** 지금 곡 바로 위 곡. 맨 위 곡이면 맨 아래 곡. 지금 곡을 모르면(목록에서 지워짐) null. */
export function getPreviousTrackId(
  trackIds: readonly string[],
  currentTrackId: string | null,
): string | null {
  const index = currentTrackId === null ? -1 : trackIds.indexOf(currentTrackId);
  if (index === -1) return null;
  return trackIds[(index - 1 + trackIds.length) % trackIds.length];
}

/** index 곡 다음 곡. 마지막 곡 다음은 맨 위 곡 (FR-04). 곡이 없으면 null. */
export function getFollowingTrackId(trackIds: readonly string[], index: number): string | null {
  if (trackIds.length === 0) return null;
  return trackIds[(index + 1) % trackIds.length];
}
