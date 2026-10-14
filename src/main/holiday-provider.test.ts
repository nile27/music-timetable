import { describe, expect, it } from 'vitest';
import { isWeekend, parseDateKey } from '../shared/day-rules';
import bundledHolidays from './data/holidays.json';
import { bundledHolidayProvider, parseHolidayData, toHolidayMap } from './holiday-provider';

describe('내장 holidays.json', () => {
  it('버려지는 항목 없이 모두 올바른 형식이다', () => {
    const { droppedCount, data } = parseHolidayData(bundledHolidays);
    expect(droppedCount).toBe(0);
    expect(data.holidays).toHaveLength(bundledHolidays.holidays.length);
  });

  it('2026·2027년을 수록한다', async () => {
    const data = await bundledHolidayProvider();
    expect(data.years).toEqual([2026, 2027]);
    for (const year of data.years) {
      expect(data.holidays.some((holiday) => holiday.date.startsWith(`${year}-`))).toBe(true);
    }
  });

  it('대체공휴일은 모두 평일이다 (주말이면 대체할 이유가 없음)', async () => {
    const data = await bundledHolidayProvider();
    const substitutes = data.holidays.filter((holiday) => holiday.name.startsWith('대체공휴일'));
    expect(substitutes.length).toBeGreaterThan(0);
    for (const holiday of substitutes) {
      const date = parseDateKey(holiday.date);
      expect(date && isWeekend(date), holiday.date).toBe(false);
    }
  });

  it('주요 날짜 확인', async () => {
    const map = toHolidayMap(await bundledHolidayProvider());
    expect(map.get('2026-03-02')).toBe('대체공휴일(삼일절)');
    expect(map.get('2026-06-03')).toBe('전국동시지방선거');
    expect(map.get('2026-10-09')).toBe('한글날');
    expect(map.get('2027-02-09')).toBe('대체공휴일(설날)');
    expect(map.has('2026-10-14')).toBe(false);
  });
});

describe('parseHolidayData', () => {
  it('형식이 틀리거나 수록 연도 밖이거나 중복인 항목은 버린다', () => {
    const { data, droppedCount } = parseHolidayData({
      years: [2026],
      holidays: [
        { date: '2026-10-09', name: '한글날' },
        { date: '2026-10-09', name: '중복' },
        { date: '2026-02-30', name: '없는 날' },
        { date: '2027-01-01', name: '수록 연도 밖' },
        { date: '2026-12-25', name: ' ' },
        { date: '2026-01-01', name: '신정' },
        'text',
        null,
      ],
    });
    expect(data).toEqual({
      years: [2026],
      holidays: [
        { date: '2026-01-01', name: '신정' },
        { date: '2026-10-09', name: '한글날' },
      ],
    });
    expect(droppedCount).toBe(6);
  });

  it.each([null, 'text', { years: 2026 }, { years: [2026], holidays: {} }])(
    '구조가 틀리면(%j) 빈 데이터',
    (raw) => {
      expect(parseHolidayData(raw).data).toEqual({ years: [], holidays: [] });
    },
  );
});
