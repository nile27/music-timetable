// 사용자에게 보이는 문구는 모두 여기에 모은다 (화면 코드에 직접 쓰지 않는다).
import type { ScheduleIssueReason } from '../shared/schedule';
import { toClock12 } from '../shared/time';
import { parseDateKey } from '../shared/day-rules';
import type { NextPlay, OffDayReason, ScheduleSlot } from '../shared/types';

/** "13:00" → "오후 1:00". 형식이 틀리면 그대로 돌려준다. */
function formatClock(time: string): string {
  const clock = toClock12(time);
  if (!clock) return time;
  return `${clock.isAfternoon ? '오후' : '오전'} ${clock.hour}:${clock.minute}`;
}

const formatRange = (slot: ScheduleSlot): string => `${slot.start} ~ ${slot.end}`;

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

/** 다음 재생 날짜: 오늘이면 생략, 내일이면 "내일", 그 뒤면 "10월 19일 (월)". */
function formatPlayDay(nextPlay: NextPlay): string {
  if (nextPlay.daysFromToday === 0) return '';
  if (nextPlay.daysFromToday === 1) return '내일 ';
  const date = parseDateKey(nextPlay.dateKey);
  if (!date) return `${nextPlay.dateKey} `;
  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${WEEKDAYS[date.getDay()]}) `;
}

function describeOffDayReason(reason: OffDayReason): string {
  switch (reason.kind) {
    case 'weekend':
      return '주말';
    case 'holiday':
      return reason.name;
    case 'off-day':
      return '쉬는 날로 지정한 날';
    case 'skip-today':
      return '오늘은 재생 안 함';
  }
}

export const MESSAGES = {
  appTitle: '음악 시간표',
  play: '재생',
  stop: '정지',
  volume: '볼륨',

  // 재생 상태 (S-01, NFR-05)
  statusPlayingSlot: (slot: ScheduleSlot): string => `재생 중: ${slot.name} (${formatRange(slot)})`,
  statusManual: '직접 재생 중',
  statusStoppedInSlot: (slot: ScheduleSlot): string => `이번 ${slot.name} 시간은 정지했어요`,
  statusNext: (nextPlay: NextPlay): string =>
    `다음 재생: ${formatPlayDay(nextPlay)}${formatClock(nextPlay.slot.start)} ${nextPlay.slot.name}`,
  statusOffDay: (reason: OffDayReason): string =>
    `오늘은 쉬는 날이에요 (${describeOffDayReason(reason)})`,
  skipToday: '오늘은 재생 안 함',
  unskipToday: '오늘 다시 재생하기',
  statusNoSchedule: '시간표가 비어 있어요. 시간을 추가해주세요.',
  statusNoTracks: '재생할 노래가 없어요. 노래 탭에서 추가해주세요.',
  nowPlaying: (title: string): string => `♪ ${title}`,

  // 시간표 (S-02)
  scheduleTitle: '재생 시간 (매일 동일)',
  scheduleName: '이름',
  scheduleStart: '시작',
  scheduleEnd: '종료',
  addSlot: '+ 시간 추가',
  deleteSlot: '삭제',
  saveSchedule: '저장',
  scheduleSaved: '저장했어요.',
  scheduleInvalid: '저장하지 못했어요. 표시된 줄을 고쳐주세요.',
  scheduleSaveFailed: '저장하지 못했어요. 다시 시도해주세요.',
  scheduleIssue: {
    'empty-name': '이름을 적어주세요.',
    'invalid-time': '시간을 입력해주세요.',
    'start-not-before-end': '끝나는 시간이 시작 시간보다 빨라요.',
    overlap: '다른 시간과 겹쳐요.',
  } satisfies Record<ScheduleIssueReason, string>,

  // 쉬는 날 달력 (S-02)
  offDayTitle: '쉬는 날',
  offDayHint: '평일을 누르면 쉬는 날로 지정하거나 해제해요. 주말·공휴일은 자동으로 쉬어요.',
  monthTitle: (year: number, month: number): string => `${year}년 ${month}월`,
  previousMonth: '‹ 이전 달',
  nextMonth: '다음 달 ›',
  weekdays: WEEKDAYS,
  offDayMark: '쉬는 날',

  // 노래 화면 (S-03)
  dropHint: '여기에 음악 파일을 끌어다 놓으세요',
  trackCount: (count: number): string => `총 ${count}곡`,
  openFolder: '폴더 열기',
  emptyLibrary: '아직 노래가 없어요. 위에 파일을 끌어다 놓아주세요',
  nextTrack: '← 다음 곡',
  added: (count: number): string => `${count}곡을 추가했어요.`,
  duplicates: (names: readonly string[]): string =>
    `이미 있는 노래라서 제외했어요: ${names.join(', ')}`,
  notAudio: (names: readonly string[]): string =>
    `음악 파일이 아니라서 제외했어요: ${names.join(', ')}`,
  addFailed: (names: readonly string[]): string => `노래를 추가하지 못했어요: ${names.join(', ')}`,
} as const;
