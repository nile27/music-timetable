// 시간표 판정. 현재 시각을 인자로 받는 순수 함수라 원하는 시각으로 테스트할 수 있다.
import { getMinutesOfDay, parseTimeToMinutes } from './time';
import type { ScheduleSlot } from './types';

export const DEFAULT_SCHEDULE: readonly ScheduleSlot[] = [
  { name: '등교', start: '08:30', end: '09:00' },
  { name: '점심', start: '13:00', end: '14:00' },
  { name: '하교', start: '17:50', end: '18:30' },
];

interface SlotRange {
  slot: ScheduleSlot;
  start: number;
  end: number;
}

/** 시각 형식이 맞고 시작 < 종료인 구간만 분 단위로 바꾼다. */
function toRanges(slots: readonly ScheduleSlot[]): SlotRange[] {
  const ranges: SlotRange[] = [];
  for (const slot of slots) {
    const start = parseTimeToMinutes(slot.start);
    const end = parseTimeToMinutes(slot.end);
    if (start !== null && end !== null && start < end) ranges.push({ slot, start, end });
  }
  return ranges;
}

/** 지금 재생해야 하는 구간. 시작 포함·종료 미포함 (13:00 이상, 14:00 미만). */
export function findActiveSlot(slots: readonly ScheduleSlot[], now: Date): ScheduleSlot | null {
  const minutes = getMinutesOfDay(now);
  return (
    toRanges(slots).find((range) => range.start <= minutes && minutes < range.end)?.slot ?? null
  );
}

export interface NextSlot {
  slot: ScheduleSlot;
  /** 오늘 남은 구간이 없어서 내일 첫 구간인 경우. */
  isTomorrow: boolean;
}

/** 다음에 시작할 구간 (지금 진행 중인 구간은 제외). 주말·휴일 반영은 4단계. */
export function findNextSlot(slots: readonly ScheduleSlot[], now: Date): NextSlot | null {
  const minutes = getMinutesOfDay(now);
  const ranges = toRanges(slots).sort((a, b) => a.start - b.start);
  if (ranges.length === 0) return null;
  const later = ranges.find((range) => range.start > minutes);
  return later
    ? { slot: later.slot, isTomorrow: false }
    : { slot: ranges[0].slot, isTomorrow: true };
}

export type ScheduleIssueReason =
  'empty-name' | 'invalid-time' | 'start-not-before-end' | 'overlap';

export interface ScheduleIssue {
  /** 문제가 있는 줄 번호 (입력 순서 기준). */
  index: number;
  reason: ScheduleIssueReason;
}

/**
 * 저장 전 검사 (FR-07). 화면은 줄마다 오류를 보여주고, main은 저장 전에 한 번 더 검사한다.
 * 겹침은 두 구간 모두에 표시한다. 한쪽 종료와 다른 쪽 시작이 같은 시각이면 겹치지 않는다.
 */
export function validateSchedule(slots: readonly ScheduleSlot[]): ScheduleIssue[] {
  const issues: ScheduleIssue[] = [];
  const valid: { index: number; start: number; end: number }[] = [];

  slots.forEach((slot, index) => {
    if (slot.name.trim() === '') issues.push({ index, reason: 'empty-name' });
    const start = parseTimeToMinutes(slot.start);
    const end = parseTimeToMinutes(slot.end);
    if (start === null || end === null) {
      issues.push({ index, reason: 'invalid-time' });
    } else if (start >= end) {
      issues.push({ index, reason: 'start-not-before-end' });
    } else {
      valid.push({ index, start, end });
    }
  });

  const overlapping = new Set<number>();
  for (let i = 0; i < valid.length; i++) {
    for (let j = i + 1; j < valid.length; j++) {
      if (valid[i].start < valid[j].end && valid[j].start < valid[i].end) {
        overlapping.add(valid[i].index);
        overlapping.add(valid[j].index);
      }
    }
  }
  for (const index of [...overlapping].sort((a, b) => a - b)) {
    issues.push({ index, reason: 'overlap' });
  }
  return issues;
}

/** 시작 시각 순으로 정렬한 사본 (S-02: 저장하면 자동 정렬). 이름 앞뒤 공백도 정리한다. */
export function normalizeSchedule(slots: readonly ScheduleSlot[]): ScheduleSlot[] {
  return slots
    .map((slot) => ({ ...slot, name: slot.name.trim() }))
    .sort((a, b) => (parseTimeToMinutes(a.start) ?? 0) - (parseTimeToMinutes(b.start) ?? 0));
}
