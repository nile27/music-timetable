import { describe, expect, it } from 'vitest';
import {
  addDays,
  findNextPlay,
  getMinutesUntil,
  getOffDayReason,
  isPlayDay,
  parseDateKey,
  type DayContext,
} from './day-rules';
import { DEFAULT_SCHEDULE } from './schedule';
import { toDateKey } from './time';

// 테스트용 공휴일 몇 개 (실제 내장 데이터 검사는 main/holiday-provider.test.ts)
const context = (patch: Partial<DayContext> = {}): DayContext => ({
  holidays: new Map([
    ['2026-10-09', '한글날'],
    ['2026-03-01', '삼일절'],
    ['2026-03-02', '대체공휴일(삼일절)'],
    ['2026-10-03', '개천절'],
    ['2026-10-05', '대체공휴일(개천절)'],
  ]),
  offDays: [],
  skipDate: null,
  ...patch,
});

const day = (month: number, date: number, hours = 8, minutes = 30): Date =>
  new Date(2026, month - 1, date, hours, minutes);

describe('시간대 확인', () => {
  it('테스트가 한국 시간대로 돈다 (08:30 KST는 UTC로 전날 23:30)', () => {
    // toISOString()을 쓰면 하루 밀린다는 것을 보여주는 테스트. 앱 코드는 toDateKey만 쓴다.
    const morning = day(10, 14, 8, 30);
    expect(morning.getTimezoneOffset()).toBe(-540);
    expect(new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(morning)).toBe(
      '2026-10-13',
    );
    expect(toDateKey(morning)).toBe('2026-10-14');
  });
});

describe('getOffDayReason', () => {
  it('평일은 재생하는 날', () => {
    expect(getOffDayReason(day(10, 14), context())).toBeNull(); // 수요일
    expect(isPlayDay(day(10, 14), context())).toBe(true);
  });

  it('토요일·일요일은 주말 (FR-10)', () => {
    expect(getOffDayReason(day(10, 17), context())).toEqual({ kind: 'weekend' }); // 토
    expect(getOffDayReason(day(10, 18), context())).toEqual({ kind: 'weekend' }); // 일
  });

  it('공휴일은 이름과 함께 (FR-11)', () => {
    expect(getOffDayReason(day(10, 9), context())).toEqual({ kind: 'holiday', name: '한글날' });
  });

  it('대체공휴일도 쉰다', () => {
    expect(getOffDayReason(day(3, 2), context())).toEqual({
      kind: 'holiday',
      name: '대체공휴일(삼일절)',
    });
    expect(isPlayDay(day(10, 5), context())).toBe(false);
  });

  it('주말과 겹친 공휴일은 공휴일 이름을 보여준다', () => {
    expect(getOffDayReason(day(10, 3), context())).toEqual({ kind: 'holiday', name: '개천절' });
  });

  it('사용자가 지정한 쉬는 날 (FR-12)', () => {
    expect(getOffDayReason(day(10, 14), context({ offDays: ['2026-10-14'] }))).toEqual({
      kind: 'off-day',
    });
  });

  it('"오늘은 재생 안 함"은 그날만 (FR-13), 다음 날 자동 해제', () => {
    const ctx = context({ skipDate: '2026-10-14' });
    expect(getOffDayReason(day(10, 14), ctx)).toEqual({ kind: 'skip-today' });
    expect(getOffDayReason(day(10, 14, 23, 59), ctx)).toEqual({ kind: 'skip-today' });
    expect(getOffDayReason(day(10, 15, 0, 0), ctx)).toBeNull();
  });

  it('08:30에 판정하는 날짜가 오늘이다 (UTC로 계산하면 어제가 됨)', () => {
    // 어제(10/13)를 쉬는 날로 지정해도 오늘(10/14) 08:30에는 재생해야 한다.
    expect(isPlayDay(day(10, 14, 8, 30), context({ offDays: ['2026-10-13'] }))).toBe(true);
    // 오늘을 쉬는 날로 지정하면 08:30에 재생하지 않는다.
    expect(isPlayDay(day(10, 14, 8, 30), context({ offDays: ['2026-10-14'] }))).toBe(false);
  });

  it('자정 직후에도 그날 날짜로 판정한다', () => {
    expect(isPlayDay(day(10, 9, 0, 0), context())).toBe(false);
    expect(isPlayDay(day(10, 8, 23, 59), context())).toBe(true);
  });
});

describe('findNextPlay', () => {
  it('평일 아침: 오늘 등교', () => {
    expect(findNextPlay(DEFAULT_SCHEDULE, day(10, 14, 7, 0), context())).toEqual({
      slot: DEFAULT_SCHEDULE[0],
      dateKey: '2026-10-14',
      daysFromToday: 0,
    });
  });

  it('진행 중인 구간은 건너뛰고 오늘 다음 구간', () => {
    expect(findNextPlay(DEFAULT_SCHEDULE, day(10, 14, 13, 30), context())?.slot.name).toBe('하교');
  });

  it('마지막 구간 뒤: 내일 첫 구간', () => {
    expect(findNextPlay(DEFAULT_SCHEDULE, day(10, 14, 20, 0), context())).toMatchObject({
      dateKey: '2026-10-15',
      daysFromToday: 1,
    });
  });

  it('금요일 저녁: 주말을 건너뛰고 월요일', () => {
    expect(findNextPlay(DEFAULT_SCHEDULE, day(10, 16, 20, 0), context())).toMatchObject({
      slot: DEFAULT_SCHEDULE[0],
      dateKey: '2026-10-19',
      daysFromToday: 3,
    });
  });

  it('금요일 저녁 + 월요일 대체공휴일: 화요일', () => {
    expect(findNextPlay(DEFAULT_SCHEDULE, day(10, 2, 20, 0), context())?.dateKey).toBe(
      '2026-10-06',
    );
  });

  it('오늘이 쉬는 날이면 오늘 남은 구간은 건너뛴다', () => {
    const ctx = context({ skipDate: '2026-10-14' });
    expect(findNextPlay(DEFAULT_SCHEDULE, day(10, 14, 7, 0), ctx)?.dateKey).toBe('2026-10-15');
  });

  it('시간표가 비었으면 null', () => {
    expect(findNextPlay([], day(10, 14), context())).toBeNull();
  });

  it('시간표 입력 순서와 무관하게 가장 이른 구간', () => {
    const shuffled = [DEFAULT_SCHEDULE[2], DEFAULT_SCHEDULE[0], DEFAULT_SCHEDULE[1]];
    expect(findNextPlay(shuffled, day(10, 14, 20, 0), context())?.slot.name).toBe('등교');
  });
});

describe('parseDateKey / addDays', () => {
  it('로컬 자정으로 바꾼다', () => {
    const date = parseDateKey('2026-10-14');
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(9);
    expect(date?.getDate()).toBe(14);
    expect(date?.getHours()).toBe(0);
  });

  it.each(['2026-02-30', '2026-13-01', '2026-1-1', 'abc'])('없는 날짜(%s) → null', (key) => {
    expect(parseDateKey(key)).toBeNull();
  });

  it('월·연도가 넘어가도 날짜 단위로 더한다', () => {
    expect(toDateKey(addDays(new Date(2026, 11, 31, 8, 30), 1))).toBe('2027-01-01');
    expect(toDateKey(addDays(new Date(2027, 1, 28), 1))).toBe('2027-03-01');
  });
});

describe('getMinutesUntil', () => {
  it('같은 날 남은 분 (초는 올림)', () => {
    expect(getMinutesUntil(new Date(2026, 9, 14, 13, 28, 10), '2026-10-14', '14:00')).toBe(32);
    expect(getMinutesUntil(new Date(2026, 9, 14, 13, 28, 0), '2026-10-14', '14:00')).toBe(32);
  });

  it('다음 날까지', () => {
    expect(getMinutesUntil(new Date(2026, 9, 14, 20, 0), '2026-10-15', '08:30')).toBe(750);
  });

  it('이미 지났으면 0', () => {
    expect(getMinutesUntil(new Date(2026, 9, 14, 14, 1), '2026-10-14', '14:00')).toBe(0);
  });

  it('형식이 틀리면 0', () => {
    expect(getMinutesUntil(new Date(2026, 9, 14), 'bad', '14:00')).toBe(0);
  });
});
