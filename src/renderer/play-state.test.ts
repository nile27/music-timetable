import { describe, expect, it } from 'vitest';
import type { LibraryTrack, PlayerStatus } from '../shared/types';
import { MESSAGES } from './messages';
import { buildPlayViewModel } from './play-state';

const LUNCH = { name: 'L', start: '13:00', end: '14:00' };
const MORNING = { name: 'M', start: '08:30', end: '09:00' };
const NOW = new Date(2026, 9, 14, 13, 28, 10);

const track = (id: string): LibraryTrack => ({
  id,
  title: id,
  artist: '',
  url: '',
  coverUrl: null,
});
const TRACKS = [track('a.mp3'), track('b.mp3')];

const status = (patch: Partial<PlayerStatus> = {}): PlayerStatus => ({
  mode: 'idle',
  offDayReason: null,
  isSkippingToday: false,
  activeSlot: null,
  nextPlay: { slot: LUNCH, dateKey: '2026-10-14', daysFromToday: 0 },
  currentTrackId: null,
  nextTrackId: 'b.mp3',
  isMissingTracks: false,
  ...patch,
});

describe('buildPlayViewModel', () => {
  // 구간 재생 중: 노란색, 구간 제목, 남은 분, 지금 곡, [정지]
  it('playing in slot', () => {
    const vm = buildPlayViewModel(
      status({ mode: 'playing', activeSlot: LUNCH, currentTrackId: 'a.mp3', nextPlay: null }),
      TRACKS,
      NOW,
    );
    expect(vm).toMatchObject({
      tone: 'playing',
      pill: MESSAGES.pillPlaying,
      headline: MESSAGES.headlinePlaying(LUNCH),
      remain: MESSAGES.remainInSlot(32),
      songLabel: MESSAGES.songLabelNow,
      isSounding: true,
      miniText: MESSAGES.miniPlaying(LUNCH, 32),
    });
    expect(vm.track?.id).toBe('a.mp3');
  });

  // 대기 중: 파란색, 다음 재생 제목, 남은 시간, 다음 곡, [지금 재생]
  it('waiting for next slot', () => {
    const vm = buildPlayViewModel(status(), TRACKS, new Date(2026, 9, 14, 11, 48, 0));
    expect(vm).toMatchObject({
      tone: 'idle',
      pill: MESSAGES.pillIdle,
      remain: MESSAGES.untilNext(72),
      songLabel: MESSAGES.songLabelNext,
      isSounding: false,
      isHeadlineCompact: false,
    });
    expect(vm.track?.id).toBe('b.mp3');
  });

  // 직접 재생: 노란색, 남은 시간 없음
  it('manual play', () => {
    const vm = buildPlayViewModel(status({ mode: 'manual', currentTrackId: 'a.mp3' }), TRACKS, NOW);
    expect(vm).toMatchObject({
      tone: 'playing',
      pill: MESSAGES.pillManual,
      remain: '',
      miniText: MESSAGES.miniManual,
    });
  });

  // 오늘은 재생 안 함: 회색, 전용 제목, 사이드바에 다음 재생
  it('skip today', () => {
    const nextPlay = { slot: MORNING, dateKey: '2026-10-15', daysFromToday: 1 };
    const vm = buildPlayViewModel(
      status({ offDayReason: { kind: 'skip-today' }, isSkippingToday: true, nextPlay }),
      TRACKS,
      NOW,
    );
    expect(vm).toMatchObject({
      tone: 'off',
      pill: MESSAGES.pillOff,
      headline: MESSAGES.headlineSkipToday,
      remain: '',
      miniText: MESSAGES.miniNext(nextPlay),
    });
  });

  // 공휴일: 쉬는 이유를 제목에
  it('holiday', () => {
    const reason = { kind: 'holiday' as const, name: 'H' };
    expect(buildPlayViewModel(status({ offDayReason: reason }), TRACKS, NOW).headline).toBe(
      MESSAGES.headlineOffDay(reason),
    );
  });

  // 구간 안인데 곡이 없음
  it('missing tracks', () => {
    const vm = buildPlayViewModel(
      status({ activeSlot: LUNCH, isMissingTracks: true, nextTrackId: null }),
      [],
      NOW,
    );
    expect(vm).toMatchObject({
      headline: MESSAGES.headlineNoTracks,
      miniText: MESSAGES.miniNoTracks,
    });
    expect(vm.track).toBeNull();
  });

  // 구간 안에서 정지함
  it('stopped in slot', () => {
    expect(buildPlayViewModel(status({ activeSlot: LUNCH }), TRACKS, NOW).headline).toBe(
      MESSAGES.headlineStoppedInSlot(LUNCH),
    );
  });

  // 다음 재생이 이틀 이상 뒤면 제목을 작게, 남은 시간은 일 단위 (금 20:00 → 월 08:30)
  it('next play days later', () => {
    const nextPlay = { slot: MORNING, dateKey: '2026-10-19', daysFromToday: 3 };
    const vm = buildPlayViewModel(status({ nextPlay }), TRACKS, new Date(2026, 9, 16, 20, 0));
    expect(vm.isHeadlineCompact).toBe(true);
    expect(vm.remain).toBe(MESSAGES.untilNext(3630));
  });

  // 시간표가 비었음
  it('empty schedule', () => {
    const vm = buildPlayViewModel(status({ nextPlay: null }), TRACKS, NOW);
    expect(vm).toMatchObject({
      headline: MESSAGES.headlineNoSchedule,
      miniText: MESSAGES.miniNoSchedule,
    });
  });
});
