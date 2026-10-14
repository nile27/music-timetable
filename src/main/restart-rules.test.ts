import { describe, expect, it } from 'vitest';
import { DEFAULT_SCHEDULE } from '../shared/schedule';
import { shouldRestart } from './restart-rules';

const at = (date: number, hours: number, minutes = 0): Date =>
  new Date(2026, 9, date, hours, minutes);

const check = (patch: Partial<Parameters<typeof shouldRestart>[0]> = {}): boolean =>
  shouldRestart({
    now: at(15, 3, 0),
    startedAt: at(14, 9, 0),
    schedule: DEFAULT_SCHEDULE,
    isIdle: true,
    ...patch,
  });

describe('shouldRestart', () => {
  it('전날부터 켜져 있던 앱은 03:00에 재시작', () => {
    expect(check()).toBe(true);
    expect(check({ now: at(15, 3, 59) })).toBe(true);
  });

  it('03:00 전·04:00 이후에는 하지 않는다', () => {
    expect(check({ now: at(15, 2, 59) })).toBe(false);
    expect(check({ now: at(15, 4, 0) })).toBe(false);
    expect(check({ now: at(15, 13, 0) })).toBe(false);
  });

  it('재시작한 직후(03:00 이후 시작)에는 다시 하지 않는다 → 무한 반복 없음', () => {
    expect(check({ now: at(15, 3, 1), startedAt: at(15, 3, 0) })).toBe(false);
    expect(check({ now: at(15, 3, 30), startedAt: at(15, 3, 0) })).toBe(false);
  });

  it('02:59에 켜진 앱은 03:00에 재시작한다', () => {
    expect(check({ now: at(15, 3, 0), startedAt: at(15, 2, 59) })).toBe(true);
  });

  it('재생 중(수동 재생 포함)이면 하지 않는다', () => {
    expect(check({ isIdle: false })).toBe(false);
  });

  it('03:00~04:00이 재생 구간이면 하지 않는다 (정지 상태여도)', () => {
    const night = [{ name: '야간', start: '02:30', end: '03:30' }];
    expect(check({ schedule: night, now: at(15, 3, 10) })).toBe(false);
    expect(check({ schedule: night, now: at(15, 3, 30) })).toBe(true);
  });

  it('며칠 켜져 있었어도 매일 그 시간대에 한 번', () => {
    expect(check({ now: at(20, 3, 5), startedAt: at(15, 3, 0) })).toBe(true);
  });
});
