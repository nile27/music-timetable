// 사용자에게 보이는 문구는 모두 여기에 모은다 (화면 코드에 직접 쓰지 않는다).
import { parseDateKey } from '../shared/day-rules';
import type { ScheduleIssueReason } from '../shared/schedule';
import { toClock12 } from '../shared/time';
import type { NextPlay, OffDayReason, ScheduleSlot } from '../shared/types';

/** "13:00" → "오후 1:00". 형식이 틀리면 그대로 돌려준다. */
function formatClock(time: string): string {
  const clock = toClock12(time);
  if (!clock) return time;
  return `${clock.isAfternoon ? '오후' : '오전'} ${clock.hour}:${clock.minute}`;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

/** 다음 재생 날짜: 오늘이면 생략, 내일이면 "내일", 그 뒤면 "10월 19일 (월)". */
function formatPlayDay(nextPlay: NextPlay): string {
  if (nextPlay.daysFromToday === 0) return '';
  if (nextPlay.daysFromToday === 1) return '내일 ';
  const date = parseDateKey(nextPlay.dateKey);
  if (!date) return `${nextPlay.dateKey} `;
  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${WEEKDAYS[date.getDay()]}) `;
}

/** 남은 분 → "1시간 12분" / "32분" / "2시간" */
function formatMinutes(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours === 0) return `${minutes}분`;
  return minutes === 0 ? `${hours}시간` : `${hours}시간 ${minutes}분`;
}

function describeOffDayReason(reason: OffDayReason): string {
  switch (reason.kind) {
    case 'weekend':
      return '주말';
    case 'holiday':
      return reason.name;
    case 'off-day':
      return '쉬는 날로 정한 날';
    case 'skip-today':
      return '오늘은 재생 안 함';
  }
}

const nextPlayText = (nextPlay: NextPlay): string =>
  `${formatPlayDay(nextPlay)}${formatClock(nextPlay.slot.start)} ${nextPlay.slot.name}`;

export const MESSAGES = {
  appTitle: '음악 시간표',

  // 탭 메뉴
  tabPlay: '재생',
  tabSchedule: '시간표',
  tabSongs: '노래',
  tabSettings: '설정',
  miniStatusLabel: '지금 상태',

  // 재생 화면 — 상태 (S-01, NFR-05)
  pillPlaying: '재생 중',
  pillManual: '직접 재생 중',
  pillIdle: '대기 중',
  pillOff: '오늘은 쉼',
  headlinePlaying: (slot: ScheduleSlot): string => `${slot.name} · ${slot.start}~${slot.end}`,
  headlineManual: '정지할 때까지 재생해요',
  headlineNext: (nextPlay: NextPlay): string => `다음 재생: ${nextPlayText(nextPlay)}`,
  headlineStoppedInSlot: (slot: ScheduleSlot): string => `이번 ${slot.name} 시간은 정지했어요`,
  headlineSkipToday: '오늘은 음악이 나오지 않아요',
  headlineOffDay: (reason: OffDayReason): string =>
    `오늘은 쉬는 날이에요 (${describeOffDayReason(reason)})`,
  headlineNoTracks: '재생할 노래가 없어요',
  headlineNoSchedule: '시간표가 비어 있어요',
  remainInSlot: (minutes: number): string => `${formatMinutes(minutes)} 남음`,
  untilNext: (minutes: number): string =>
    minutes >= 24 * 60 ? `${Math.floor(minutes / (24 * 60))}일 뒤` : `${formatMinutes(minutes)} 뒤`,

  // 사이드바 "지금 상태" 카드
  miniPlaying: (slot: ScheduleSlot, minutes: number): string =>
    `${slot.name} · ${formatMinutes(minutes)} 남음`,
  miniManual: '정지 버튼을 누르면 멈춰요',
  miniNext: (nextPlay: NextPlay): string => `다음: ${nextPlayText(nextPlay)}`,
  miniNoTracks: '노래를 추가해주세요',
  miniNoSchedule: '시간표를 추가해주세요',

  // 재생 화면 — 플레이어
  songLabelNow: '지금 나오는 곡',
  songLabelNext: '다음 곡',
  noTrackTitle: '노래가 없어요',
  noTrackArtist: '노래 탭에서 음악 파일을 추가해주세요',
  stop: '정지',
  playNow: '지금 재생',
  volume: '볼륨',
  volumeValue: (percent: number): string => `${percent}%`,

  // 재생 화면 — 오늘 끄기 (FR-13)
  skipTodayTitle: '오늘은 재생 안 함',
  skipTodayDesc: '켜면 오늘 하루만 음악이 나오지 않아요. 내일은 다시 나와요.',

  // 시간표 (S-02)
  scheduleTitle: '시간표',
  scheduleSubtitle: '평일(월~금)에만 음악이 나와요.',
  scheduleSection: '재생 시간',
  scheduleName: '이름',
  scheduleStart: '시작',
  scheduleEnd: '끝',
  newSlotName: '새 시간',
  addSlot: '시간 추가',
  deleteSlot: (name: string): string => `${name || '이 줄'} 삭제`,
  saveSchedule: '저장',
  scheduleSaved: '저장했어요.',
  scheduleInvalid: '겹치거나 잘못된 시간을 고치면 저장할 수 있어요.',
  scheduleSaveFailed: '저장하지 못했어요. 다시 시도해주세요.',
  scheduleIssue: {
    'empty-name': '이름을 적어주세요.',
    'invalid-time': '시간은 08:30처럼 적어주세요.',
    'start-not-before-end': '끝나는 시간이 시작 시간보다 빨라요.',
    overlap: '다른 시간과 겹쳐요.',
  } satisfies Record<ScheduleIssueReason, string>,

  // 쉬는 날 달력 (S-02)
  offDayTitle: '쉬는 날',
  offDayHint: '날짜를 누르면 쉬는 날로 정하거나 풀 수 있어요.',
  monthTitle: (year: number, month: number): string => `${year}년 ${month}월`,
  previousMonth: '이전 달',
  nextMonth: '다음 달',
  weekdays: WEEKDAYS,
  offDayMark: '쉬는 날',
  /** 달력 칸이 좁아서 "대체공휴일(개천절)"은 "대체 공휴일"로 줄인다. */
  holidayShortLabel: (name: string): string =>
    name.startsWith('대체공휴일') ? '대체 공휴일' : name,
  dayLabel: (month: number, date: number, note: string): string =>
    `${month}월 ${date}일${note ? `, ${note}` : ''}`,
  weekendMark: '주말',
  legendWeekend: '주말',
  legendHoliday: '공휴일',
  legendOffDay: '직접 정한 쉬는 날',
  legendToday: '오늘',

  // 노래 화면 (S-03)
  songsTitle: '노래',
  trackCount: (count: number): string => `총 ${count}곡`,
  openFolder: '폴더 열기',
  dropHint: '여기에 음악 파일을 끌어다 놓으세요',
  emptyLibrary: '아직 노래가 없어요. 위에 파일을 끌어다 놓아주세요',
  badgeNow: '지금 재생 중',
  badgeNext: '다음 재생',
  added: (count: number): string => `${count}곡을 추가했어요.`,
  duplicates: (names: readonly string[]): string =>
    `이미 있는 노래라서 제외했어요: ${names.join(', ')}`,
  notAudio: (names: readonly string[]): string =>
    `음악 파일이 아니라서 제외했어요: ${names.join(', ')}`,
  addFailed: (names: readonly string[]): string => `노래를 추가하지 못했어요: ${names.join(', ')}`,

  // 설정 (S-04)
  settingsTitle: '설정',
  autoLaunch: 'PC 켜질 때 자동 실행',
  autoLaunchDesc: 'PC를 켜면 이 프로그램이 저절로 시작돼요.',
  appInfoTitle: '앱 정보',
  appVersion: '버전',
  holidayInfo: '공휴일 정보',
  holidayUntil: (year: number | null): string => (year === null ? '없음' : `${year}년까지`),
  windowGuide:
    '창만 숨기려면 – 버튼을 눌러주세요. X를 누르면 프로그램이 꺼져서 정해진 시간에 음악이 나오지 않아요.',
} as const;
