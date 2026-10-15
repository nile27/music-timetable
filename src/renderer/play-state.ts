// 메인이 보낸 상태(PlayerStatus)를 재생 화면·사이드바에 보여줄 값으로 바꾼다.
// 화면 요소를 건드리지 않는 순수 함수라 상태별 문구를 테스트할 수 있다.
import { getMinutesUntil } from '../shared/day-rules';
import { toDateKey } from '../shared/time';
import type { LibraryTrack, PlayerStatus } from '../shared/types';
import { MESSAGES } from './messages';

/** 색 구분: 재생(노랑) / 대기(파랑) / 쉼(회색). 디자인 시스템 state/* 색과 같다. */
export type PlayTone = 'playing' | 'idle' | 'off';

export interface PlayViewModel {
  tone: PlayTone;
  pill: string;
  headline: string;
  /** 날짜까지 붙어 제목이 길어질 때 글자를 줄인다. */
  isHeadlineCompact: boolean;
  /** 오른쪽 큰 숫자 ("32분 남음" / "1시간 12분 뒤"). 없으면 빈 문자열. */
  remain: string;
  songLabel: string;
  /** 보여줄 곡: 소리가 나는 중이면 지금 곡, 아니면 다음 곡. */
  track: LibraryTrack | null;
  /** 소리가 나는 중이면 [정지], 아니면 [지금 재생]. */
  isSounding: boolean;
  miniText: string;
}

export function buildPlayViewModel(
  status: PlayerStatus,
  tracks: readonly LibraryTrack[],
  now: Date,
): PlayViewModel {
  const findTrack = (id: string | null): LibraryTrack | null =>
    tracks.find((track) => track.id === id) ?? null;
  const isSounding = status.mode !== 'idle';
  const next = status.nextPlay;
  const untilNext = next
    ? MESSAGES.untilNext(getMinutesUntil(now, next.dateKey, next.slot.start))
    : '';
  const miniNext = next ? MESSAGES.miniNext(next) : MESSAGES.miniNoSchedule;

  const base = {
    isHeadlineCompact: false,
    songLabel: isSounding ? MESSAGES.songLabelNow : MESSAGES.songLabelNext,
    track: findTrack(isSounding ? status.currentTrackId : status.nextTrackId),
    isSounding,
  };

  if (status.mode === 'playing' && status.activeSlot) {
    const minutes = getMinutesUntil(now, toDateKey(now), status.activeSlot.end);
    return {
      ...base,
      tone: 'playing',
      pill: MESSAGES.pillPlaying,
      headline: MESSAGES.headlinePlaying(status.activeSlot),
      remain: MESSAGES.remainInSlot(minutes),
      miniText: MESSAGES.miniPlaying(status.activeSlot, minutes),
    };
  }
  if (isSounding) {
    return {
      ...base,
      tone: 'playing',
      pill: MESSAGES.pillManual,
      headline: MESSAGES.headlineManual,
      remain: '',
      miniText: MESSAGES.miniManual,
    };
  }
  if (status.offDayReason) {
    return {
      ...base,
      tone: 'off',
      pill: MESSAGES.pillOff,
      headline:
        status.offDayReason.kind === 'skip-today'
          ? MESSAGES.headlineSkipToday
          : MESSAGES.headlineOffDay(status.offDayReason),
      remain: '',
      miniText: miniNext,
    };
  }

  const idle = { ...base, tone: 'idle' as const, pill: MESSAGES.pillIdle };
  if (status.isMissingTracks) {
    return {
      ...idle,
      headline: MESSAGES.headlineNoTracks,
      remain: '',
      miniText: MESSAGES.miniNoTracks,
    };
  }
  if (status.activeSlot) {
    return {
      ...idle,
      headline: MESSAGES.headlineStoppedInSlot(status.activeSlot),
      remain: untilNext,
      miniText: miniNext,
    };
  }
  if (next) {
    return {
      ...idle,
      headline: MESSAGES.headlineNext(next),
      isHeadlineCompact: next.daysFromToday >= 2,
      remain: untilNext,
      miniText: miniNext,
    };
  }
  return { ...idle, headline: MESSAGES.headlineNoSchedule, remain: '', miniText: miniNext };
}
