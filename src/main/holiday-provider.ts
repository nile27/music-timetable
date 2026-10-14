// 공휴일 공급자 (아키텍처 9장). 휴무일 판정은 공휴일을 반드시 이 함수를 통해서만 받는다.
// 1차(MVP)는 앱에 내장한 JSON을 돌려주고, 2차에서 이 함수 안쪽만 공공데이터 API 호출로 바꾼다.
// 그래서 지금은 필요 없지만 API처럼 비동기 함수 모양으로 둔다.
import type { Holiday, HolidayData } from '../shared/types';
import { parseDateKey } from '../shared/day-rules';
import bundledHolidays from './data/holidays.json';

export type HolidayProvider = () => Promise<HolidayData>;

/**
 * 공휴일 데이터 검사. 형식이 틀린 항목은 버리고(로그용으로 개수를 돌려줌), 수록 연도 밖 날짜도 버린다.
 * 공휴일을 하나 잘못 읽으면 그날 음악이 나오거나 안 나오므로 조용히 넘기지 않는다.
 */
export function parseHolidayData(raw: unknown): { data: HolidayData; droppedCount: number } {
  const empty = { data: { years: [], holidays: [] }, droppedCount: 0 };
  if (typeof raw !== 'object' || raw === null) return empty;
  const { years, holidays } = raw as Record<string, unknown>;
  if (!Array.isArray(years) || !Array.isArray(holidays)) return empty;

  const validYears = years.filter((year): year is number => Number.isInteger(year));
  const seen = new Set<string>();
  const valid: Holiday[] = [];
  let droppedCount = 0;

  for (const item of holidays) {
    const { date, name } = (item ?? {}) as Record<string, unknown>;
    const isValid =
      typeof date === 'string' &&
      typeof name === 'string' &&
      name.trim() !== '' &&
      parseDateKey(date) !== null &&
      validYears.includes(Number(date.slice(0, 4))) &&
      !seen.has(date);
    if (!isValid) {
      droppedCount++;
      continue;
    }
    seen.add(date);
    valid.push({ date, name });
  }

  valid.sort((a, b) => (a.date < b.date ? -1 : 1));
  return { data: { years: validYears, holidays: valid }, droppedCount };
}

/** 1차 구현: 앱에 내장한 holidays.json. */
export const bundledHolidayProvider: HolidayProvider = () => {
  const { data, droppedCount } = parseHolidayData(bundledHolidays);
  if (droppedCount > 0)
    console.warn(`[holiday] 형식이 틀린 공휴일 ${droppedCount}개를 제외했습니다`);
  return Promise.resolve(data);
};

/** 판정 함수에 넘길 날짜 키 → 이름 Map. */
export function toHolidayMap(data: HolidayData): ReadonlyMap<string, string> {
  return new Map(data.holidays.map((holiday) => [holiday.date, holiday.name]));
}
