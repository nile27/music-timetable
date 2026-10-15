// 휴무일 판정 (FR-10~13). 날짜를 인자로 받는 순수 함수라 원하는 날짜로 테스트할 수 있다.
// 공휴일 목록은 HolidayProvider가 준 것을 Map으로 받기만 한다 (어디서 왔는지 모름 → 2차 API 교체 대비).
import { getMinutesOfDay, parseTimeToMinutes, toDateKey } from './time';
import type { NextPlay, OffDayReason, ScheduleSlot } from './types';

export interface DayContext {
  /** 날짜 키 → 공휴일 이름 */
  holidays: ReadonlyMap<string, string>;
  /** 사용자가 지정한 쉬는 날 */
  offDays: readonly string[];
  /** "오늘은 재생 안 함"을 켠 날짜. 이 날짜와 같은 날에만 효과가 있어 다음 날 자동으로 풀린다. */
  skipDate: string | null;
}

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "YYYY-MM-DD" → 그날 로컬 자정. 없는 날짜(2월 30일 등)면 null. */
export function parseDateKey(dateKey: string): Date | null {
  const match = DATE_KEY_PATTERN.exec(dateKey);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return toDateKey(date) === dateKey ? date : null;
}

/** 로컬 날짜 기준 n일 뒤 (시각은 유지). 서머타임이 없어도 날짜 단위로 더해 안전하게 계산한다. */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * 그날 재생하지 않는 이유. 재생하는 날이면 null.
 * 이유가 여러 개면 화면에 보여주기 좋은 순서(공휴일 이름 > 주말 > 지정한 쉬는 날 > 오늘은 재생 안 함)로 하나만.
 */
export function getOffDayReason(date: Date, context: DayContext): OffDayReason | null {
  const dateKey = toDateKey(date);
  const holidayName = context.holidays.get(dateKey);
  if (holidayName !== undefined) return { kind: 'holiday', name: holidayName };
  if (isWeekend(date)) return { kind: 'weekend' };
  if (context.offDays.includes(dateKey)) return { kind: 'off-day' };
  if (context.skipDate === dateKey) return { kind: 'skip-today' };
  return null;
}

export function isPlayDay(date: Date, context: DayContext): boolean {
  return getOffDayReason(date, context) === null;
}

/** 쉬는 날을 몇 날까지 건너뛰며 찾을지. 시간표가 있으면 1년 안에 평일은 반드시 있다. */
const MAX_LOOKAHEAD_DAYS = 366;

/**
 * 다음 재생 일정 (NFR-05). 오늘 남은 구간 → 다음 재생하는 날의 첫 구간 순.
 * 진행 중인 구간은 "다음"이 아니므로 제외한다.
 */
export function findNextPlay(
  slots: readonly ScheduleSlot[],
  now: Date,
  context: DayContext,
): NextPlay | null {
  const sorted = slots
    .map((slot) => ({
      slot,
      start: parseTimeToMinutes(slot.start),
      end: parseTimeToMinutes(slot.end),
    }))
    .filter(
      (item): item is { slot: ScheduleSlot; start: number; end: number } =>
        item.start !== null && item.end !== null && item.start < item.end,
    )
    .sort((a, b) => a.start - b.start);
  if (sorted.length === 0) return null;

  if (isPlayDay(now, context)) {
    const minutes = getMinutesOfDay(now);
    const later = sorted.find((item) => item.start > minutes);
    if (later) return { slot: later.slot, dateKey: toDateKey(now), daysFromToday: 0 };
  }

  for (let days = 1; days <= MAX_LOOKAHEAD_DAYS; days++) {
    const day = addDays(now, days);
    if (isPlayDay(day, context)) {
      return { slot: sorted[0].slot, dateKey: toDateKey(day), daysFromToday: days };
    }
  }
  return null;
}

/**
 * 지금부터 그 날짜·시각까지 남은 분 (올림, 0 이상). "32분 남음", "1시간 12분 뒤" 표시용.
 * 올림하는 이유: 13:28:10에 14:00까지는 31분 50초 → "32분 남음"이 사람이 기대하는 값.
 */
export function getMinutesUntil(now: Date, dateKey: string, time: string): number {
  const date = parseDateKey(dateKey);
  const minutes = parseTimeToMinutes(time);
  if (!date || minutes === null) return 0;
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return Math.max(0, Math.ceil((date.getTime() - now.getTime()) / 60_000));
}
