import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SCHEDULE,
  findActiveSlot,
  findNextSlot,
  normalizeSchedule,
  validateSchedule,
} from './schedule';
import type { ScheduleSlot } from './types';

const at = (hours: number, minutes: number, seconds = 0): Date =>
  new Date(2026, 9, 14, hours, minutes, seconds);

describe('findActiveSlot (기본 시간표 경계)', () => {
  it.each([
    ['08:29:59 → 재생 안 함', at(8, 29, 59), null],
    ['08:30:00 → 등교', at(8, 30, 0), '등교'],
    ['08:59:59 → 등교', at(8, 59, 59), '등교'],
    ['09:00:00 → 재생 안 함', at(9, 0, 0), null],
    ['13:00:00 → 점심', at(13, 0, 0), '점심'],
    ['13:59:59 → 점심', at(13, 59, 59), '점심'],
    ['14:00:00 → 재생 안 함', at(14, 0, 0), null],
    ['17:50:00 → 하교', at(17, 50, 0), '하교'],
    ['18:30:00 → 재생 안 함', at(18, 30, 0), null],
    ['자정 → 재생 안 함', at(0, 0, 0), null],
  ])('%s', (_name, now, expected) => {
    expect(findActiveSlot(DEFAULT_SCHEDULE, now)?.name ?? null).toBe(expected);
  });

  it('형식이 틀린 구간은 무시한다', () => {
    const slots: ScheduleSlot[] = [
      { name: '깨짐', start: '8:00', end: '10:00' },
      { name: '거꾸로', start: '10:00', end: '09:00' },
    ];
    expect(findActiveSlot(slots, at(9, 0))).toBeNull();
  });

  it('붙어 있는 구간은 종료 시각부터 다음 구간', () => {
    const slots: ScheduleSlot[] = [
      { name: 'A', start: '10:00', end: '10:30' },
      { name: 'B', start: '10:30', end: '11:00' },
    ];
    expect(findActiveSlot(slots, at(10, 29, 59))?.name).toBe('A');
    expect(findActiveSlot(slots, at(10, 30))?.name).toBe('B');
  });
});

describe('findNextSlot', () => {
  it('구간 전이면 오늘 다음 구간', () => {
    expect(findNextSlot(DEFAULT_SCHEDULE, at(7, 0))).toEqual({
      slot: DEFAULT_SCHEDULE[0],
      isTomorrow: false,
    });
  });

  it('구간 진행 중이면 그다음 구간', () => {
    expect(findNextSlot(DEFAULT_SCHEDULE, at(8, 45))?.slot.name).toBe('점심');
  });

  it('시작 시각과 같은 분이면 이미 시작한 것으로 본다', () => {
    expect(findNextSlot(DEFAULT_SCHEDULE, at(13, 0))?.slot.name).toBe('하교');
  });

  it('마지막 구간 뒤면 내일 첫 구간', () => {
    expect(findNextSlot(DEFAULT_SCHEDULE, at(20, 0))).toEqual({
      slot: DEFAULT_SCHEDULE[0],
      isTomorrow: true,
    });
  });

  it('입력 순서가 섞여 있어도 시작 시각 기준', () => {
    const shuffled = [DEFAULT_SCHEDULE[2], DEFAULT_SCHEDULE[0], DEFAULT_SCHEDULE[1]];
    expect(findNextSlot(shuffled, at(10, 0))?.slot.name).toBe('점심');
    expect(findNextSlot(shuffled, at(19, 0))?.slot.name).toBe('등교');
  });

  it('구간이 없으면 null', () => {
    expect(findNextSlot([], at(10, 0))).toBeNull();
  });
});

describe('validateSchedule', () => {
  it('기본 시간표는 문제 없음', () => {
    expect(validateSchedule(DEFAULT_SCHEDULE)).toEqual([]);
  });

  it('빈 시간표도 허용', () => {
    expect(validateSchedule([])).toEqual([]);
  });

  it('시작 ≥ 종료', () => {
    expect(
      validateSchedule([
        { name: 'A', start: '09:00', end: '08:30' },
        { name: 'B', start: '10:00', end: '10:00' },
      ]),
    ).toEqual([
      { index: 0, reason: 'start-not-before-end' },
      { index: 1, reason: 'start-not-before-end' },
    ]);
  });

  it('겹치면 두 줄 모두 표시', () => {
    expect(
      validateSchedule([
        { name: 'A', start: '08:30', end: '09:00' },
        { name: 'B', start: '13:00', end: '14:00' },
        { name: 'C', start: '08:50', end: '09:10' },
      ]),
    ).toEqual([
      { index: 0, reason: 'overlap' },
      { index: 2, reason: 'overlap' },
    ]);
  });

  it('한 구간이 다른 구간 안에 통째로 들어가도 겹침', () => {
    expect(
      validateSchedule([
        { name: 'A', start: '13:00', end: '14:00' },
        { name: 'B', start: '13:10', end: '13:20' },
      ]).map((issue) => issue.reason),
    ).toEqual(['overlap', 'overlap']);
  });

  it('종료와 시작이 같은 시각이면 겹치지 않음', () => {
    expect(
      validateSchedule([
        { name: 'A', start: '08:30', end: '09:00' },
        { name: 'B', start: '09:00', end: '09:30' },
      ]),
    ).toEqual([]);
  });

  it('이름이 비었거나 시각 형식이 틀림', () => {
    expect(validateSchedule([{ name: '  ', start: '', end: '09:00' }])).toEqual([
      { index: 0, reason: 'empty-name' },
      { index: 0, reason: 'invalid-time' },
    ]);
  });
});

describe('normalizeSchedule', () => {
  it('시작 시각 순으로 정렬하고 이름 공백을 정리한다', () => {
    expect(
      normalizeSchedule([
        { name: ' 하교 ', start: '17:50', end: '18:30' },
        { name: '등교', start: '08:30', end: '09:00' },
      ]),
    ).toEqual([
      { name: '등교', start: '08:30', end: '09:00' },
      { name: '하교', start: '17:50', end: '18:30' },
    ]);
  });
});
