import { describe, expect, it } from 'vitest';
import {
  decideManualPlay,
  decidePlayTrack,
  decideStop,
  decideTick,
  findTrackIndex,
  getFollowingTrackId,
  getPreviousTrackId,
  INITIAL_SCHEDULER_STATE,
  toSlotKey,
  type SchedulerState,
  type SlotKey,
} from './scheduler-rules';

const LUNCH = toSlotKey('2026-10-14', { start: '13:00', end: '14:00' });
const NEXT = toSlotKey('2026-10-14', { start: '14:00', end: '14:30' });
const LUNCH_TOMORROW = toSlotKey('2026-10-15', { start: '13:00', end: '14:00' });

/** 매초 판정을 순서대로 돌려 동작 목록을 얻는다. */
function runTicks(
  keys: SlotKey[],
  start: SchedulerState = INITIAL_SCHEDULER_STATE,
  hasTracks = true,
): { actions: string[]; state: SchedulerState } {
  let state = start;
  const actions: string[] = [];
  for (const key of keys) {
    const decision = decideTick(state, key, hasTracks);
    state = decision.state;
    actions.push(decision.action);
  }
  return { actions, state };
}

describe('toSlotKey', () => {
  it('구간 밖이면 null, 날짜가 다르면 다른 키', () => {
    expect(toSlotKey('2026-10-14', null)).toBeNull();
    expect(LUNCH).not.toBe(LUNCH_TOMORROW);
  });
});

describe('decideTick (자동 재생)', () => {
  it('구간 시작에 재생, 진행 중엔 그대로, 종료에 정지 (FR-02·03)', () => {
    expect(runTicks([null, LUNCH, LUNCH, LUNCH, null, null]).actions).toEqual([
      'none',
      'start',
      'none',
      'none',
      'stop',
      'none',
    ]);
  });

  it('늦게 켜져도 구간 안이면 첫 판정에서 바로 재생 (FR-06)', () => {
    expect(runTicks([LUNCH]).actions).toEqual(['start']);
  });

  it('곡이 없으면 틀지 않고, 구간 중에 곡이 생기면 그때 재생', () => {
    let { state, actions } = runTicks([LUNCH, LUNCH], INITIAL_SCHEDULER_STATE, false);
    expect(actions).toEqual(['none', 'none']);
    ({ state, actions } = runTicks([LUNCH], state, true));
    expect(actions).toEqual(['start']);
    expect(state.mode).toBe('playing');
  });

  it('붙어 있는 다음 구간으로 넘어가면 끊지 않는다', () => {
    const { actions, state } = runTicks([LUNCH, NEXT, null]);
    expect(actions).toEqual(['start', 'none', 'stop']);
    expect(state.mode).toBe('idle');
  });

  it('다음 날 같은 구간도 다시 재생', () => {
    expect(runTicks([LUNCH, null, LUNCH_TOMORROW]).actions).toEqual(['start', 'stop', 'start']);
  });
});

describe('수동 재생·정지', () => {
  it('구간 밖 [재생] → manual, 매초 판정이 끄지 않는다', () => {
    const play = decideManualPlay(INITIAL_SCHEDULER_STATE, null, true);
    expect(play.action).toBe('start');
    expect(play.state.mode).toBe('manual');
    expect(runTicks([null, null, null], play.state).actions).toEqual(['none', 'none', 'none']);
  });

  it('수동 재생 중 구간이 시작되면 이어서 재생하고, 구간 종료에 정지', () => {
    const play = decideManualPlay(INITIAL_SCHEDULER_STATE, null, true);
    const { actions, state } = runTicks([null, LUNCH, LUNCH, null], play.state);
    expect(actions).toEqual(['none', 'none', 'none', 'stop']);
    expect(state.mode).toBe('idle');
  });

  it('구간 안 [재생] → 스케줄 재생과 같고 구간 종료에 정지', () => {
    const play = decideManualPlay(INITIAL_SCHEDULER_STATE, LUNCH, true);
    expect(play.state.mode).toBe('playing');
    expect(runTicks([LUNCH, null], play.state).actions).toEqual(['none', 'stop']);
  });

  it('구간 안 [정지] → 그 구간 동안은 다시 틀지 않고, 다음 구간엔 재생', () => {
    const playing = runTicks([LUNCH]).state;
    const stop = decideStop(playing, LUNCH);
    expect(stop.action).toBe('stop');
    expect(runTicks([LUNCH, LUNCH, null, LUNCH_TOMORROW], stop.state).actions).toEqual([
      'none',
      'none',
      'none',
      'start',
    ]);
  });

  it('구간 안에서 정지했어도 [재생]을 누르면 다시 재생', () => {
    const stopped = decideStop(runTicks([LUNCH]).state, LUNCH).state;
    const play = decideManualPlay(stopped, LUNCH, true);
    expect(play.action).toBe('start');
    expect(play.state.suppressedSlotKey).toBeNull();
  });

  it('재생 중에 [재생]을 또 누르면 아무것도 안 함', () => {
    expect(decideManualPlay(runTicks([LUNCH]).state, LUNCH, true).action).toBe('none');
  });

  it('곡이 없으면 [재생]해도 아무것도 안 함', () => {
    expect(decideManualPlay(INITIAL_SCHEDULER_STATE, null, false).action).toBe('none');
  });

  it('정지 상태에서 [정지]는 아무것도 안 함', () => {
    expect(decideStop(INITIAL_SCHEDULER_STATE, null).action).toBe('none');
  });
});

describe('decidePlayTrack (노래 목록에서 두 번 누르기)', () => {
  it('구간 밖 정지 상태 → 수동 재생', () => {
    expect(decidePlayTrack(INITIAL_SCHEDULER_STATE, null)).toEqual({
      state: { mode: 'manual', playingSlotKey: null, suppressedSlotKey: null },
      action: 'start',
    });
  });

  it('구간 안 정지 상태 → 스케줄 재생 (구간 끝에 정지)', () => {
    expect(decidePlayTrack(INITIAL_SCHEDULER_STATE, LUNCH).state).toEqual({
      mode: 'playing',
      playingSlotKey: LUNCH,
      suppressedSlotKey: null,
    });
  });

  it('구간 안에서 [정지]해 둔 상태여도 바로 재생', () => {
    const stopped = decideStop(runTicks([LUNCH]).state, LUNCH).state;
    const play = decidePlayTrack(stopped, LUNCH);
    expect(play.action).toBe('start');
    expect(play.state.mode).toBe('playing');
    expect(play.state.suppressedSlotKey).toBeNull();
  });

  it.each([
    ['스케줄 재생', runTicks([LUNCH]).state],
    ['수동 재생', decideManualPlay(INITIAL_SCHEDULER_STATE, null, true).state],
  ])('%s 중 → 모드는 그대로, 곡만 바꿈', (_name, state) => {
    expect(decidePlayTrack(state, LUNCH)).toEqual({ state, action: 'start' });
  });

  it('곡을 바꾼 뒤에도 스케줄 재생은 구간이 끝나면 정지', () => {
    const playing = decidePlayTrack(runTicks([LUNCH]).state, LUNCH).state;
    expect(runTicks([LUNCH, null], playing).actions).toEqual(['none', 'stop']);
  });
});

describe('getPreviousTrackId', () => {
  const IDS = ['a.mp3', 'b.mp3', 'c.mp3'];

  it('지금 곡 바로 위 곡', () => {
    expect(getPreviousTrackId(IDS, 'c.mp3')).toBe('b.mp3');
  });

  it('맨 위 곡이면 맨 아래 곡', () => {
    expect(getPreviousTrackId(IDS, 'a.mp3')).toBe('c.mp3');
    expect(getPreviousTrackId(['a.mp3'], 'a.mp3')).toBe('a.mp3');
  });

  it('지금 곡을 모르면 null', () => {
    expect(getPreviousTrackId(IDS, null)).toBeNull();
    expect(getPreviousTrackId(IDS, 'deleted.mp3')).toBeNull();
  });
});

describe('findTrackIndex / getFollowingTrackId', () => {
  const IDS = ['a.mp3', 'b.mp3', 'c.mp3'];

  it('저장된 다음 곡의 위치', () => {
    expect(findTrackIndex(IDS, 'b.mp3')).toBe(1);
  });

  it('다음 곡이 없거나 목록에 없으면 맨 위 곡부터', () => {
    expect(findTrackIndex(IDS, null)).toBe(0);
    expect(findTrackIndex(IDS, 'deleted.mp3')).toBe(0);
    expect(findTrackIndex([], 'a.mp3')).toBe(0);
  });

  it('다음 곡 이름', () => {
    expect(getFollowingTrackId(IDS, 0)).toBe('b.mp3');
    expect(getFollowingTrackId(IDS, 1)).toBe('c.mp3');
  });

  it('마지막 곡 다음은 맨 위 곡 (FR-04)', () => {
    expect(getFollowingTrackId(IDS, 2)).toBe('a.mp3');
    expect(getFollowingTrackId(['a.mp3'], 0)).toBe('a.mp3');
  });

  it('곡이 없으면 null', () => {
    expect(getFollowingTrackId([], 0)).toBeNull();
  });
});
