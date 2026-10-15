import { describe, expect, it } from 'vitest';
import {
  formatMediaTime,
  getMinutesOfDay,
  normalizeTimeInput,
  parseTimeToMinutes,
  toClock12,
  toDateKey,
} from './time';

describe('parseTimeToMinutes', () => {
  it.each([
    ['00:00', 0],
    ['08:30', 510],
    ['13:05', 785],
    ['23:59', 1439],
  ])('%s → %i', (time, minutes) => {
    expect(parseTimeToMinutes(time)).toBe(minutes);
  });

  it.each(['24:00', '8:30', '08:60', '0830', '', '08:30:00', 'ab:cd'])('%s → null', (time) => {
    expect(parseTimeToMinutes(time)).toBeNull();
  });
});

describe('getMinutesOfDay', () => {
  it('초는 버린다', () => {
    expect(getMinutesOfDay(new Date(2026, 9, 14, 8, 59, 59))).toBe(539);
    expect(getMinutesOfDay(new Date(2026, 9, 14, 9, 0, 0))).toBe(540);
  });
});

describe('toDateKey', () => {
  it('로컬 날짜로 만든다 (한국 오전 9시 전에도 전날로 밀리지 않음)', () => {
    expect(toDateKey(new Date(2026, 9, 14, 8, 30))).toBe('2026-10-14');
    expect(toDateKey(new Date(2026, 9, 14, 0, 0, 1))).toBe('2026-10-14');
  });

  it('한 자리 월·일은 0을 붙인다', () => {
    expect(toDateKey(new Date(2027, 0, 5))).toBe('2027-01-05');
  });
});

describe('toClock12', () => {
  it.each([
    ['08:30', false, 8, '30'],
    ['00:05', false, 12, '05'],
    ['11:59', false, 11, '59'],
    ['12:00', true, 12, '00'],
    ['13:00', true, 1, '00'],
    ['23:59', true, 11, '59'],
  ])('%s', (time, isAfternoon, hour, minute) => {
    expect(toClock12(time)).toEqual({ isAfternoon, hour, minute });
  });

  it('형식이 틀리면 null', () => {
    expect(toClock12('8:30')).toBeNull();
  });
});

describe('formatMediaTime', () => {
  it.each([
    [0, '0:00'],
    [83.4, '1:23'],
    [225, '3:45'],
    [3600, '60:00'],
    [Number.NaN, '0:00'],
    [Number.POSITIVE_INFINITY, '0:00'],
    [-5, '0:00'],
  ])('%s초 → %s', (seconds, expected) => {
    expect(formatMediaTime(seconds)).toBe(expected);
  });
});

describe('normalizeTimeInput', () => {
  it.each([
    ['08:30', '08:30'],
    ['8:30', '08:30'],
    ['830', '08:30'],
    ['0830', '08:30'],
    ['8.30', '08:30'],
    [' 13:00 ', '13:00'],
    ['2359', '23:59'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeTimeInput(input)).toBe(expected);
  });

  it.each(['', '24:00', '8:60', '12345', 'ab:cd', '8:3'])('%s → null', (input) => {
    expect(normalizeTimeInput(input)).toBeNull();
  });
});
