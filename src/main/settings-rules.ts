// settings.json 구조 검사. 파일 내용은 그대로 믿지 않고(손으로 고쳤거나 깨졌을 수 있음)
// 항목마다 검사해서 틀린 항목만 기본값으로 바꾼다. 파일이 깨져도 앱이 멈추지 않게 하기 위함.
import { DEFAULT_SCHEDULE, validateSchedule } from '../shared/schedule';
import type { AppSettings, ScheduleSlot } from '../shared/types';

export const SETTINGS_VERSION = 1;

export function createDefaultSettings(): AppSettings {
  return {
    version: SETTINGS_VERSION,
    schedule: DEFAULT_SCHEDULE.map((slot) => ({ ...slot })),
    offDays: [],
    skipDate: null,
    nextIndex: 0,
    volume: 0.8,
    autoLaunch: true,
  };
}

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 시간표 배열 검사. 형식이 맞지 않으면 null (→ 기본 시간표). */
export function parseSchedule(value: unknown): ScheduleSlot[] | null {
  if (!Array.isArray(value)) return null;
  const slots: ScheduleSlot[] = [];
  for (const item of value) {
    if (
      !isRecord(item) ||
      typeof item.name !== 'string' ||
      typeof item.start !== 'string' ||
      typeof item.end !== 'string'
    ) {
      return null;
    }
    slots.push({ name: item.name, start: item.start, end: item.end });
  }
  // 겹치거나 거꾸로 된 시간표로 돌면 엉뚱한 시각에 재생될 수 있으므로 통째로 거부한다.
  return validateSchedule(slots).length === 0 ? slots : null;
}

export interface ParsedSettings {
  settings: AppSettings;
  /** 기본값으로 바꾼 항목 이름 (로그용). */
  fixedFields: string[];
}

export function parseSettings(raw: unknown): ParsedSettings {
  const defaults = createDefaultSettings();
  if (!isRecord(raw)) return { settings: defaults, fixedFields: ['(전체)'] };

  const fixedFields: string[] = [];
  const pick = <T>(field: keyof AppSettings, parsed: T | null | undefined, fallback: T): T => {
    if (parsed === null || parsed === undefined) {
      fixedFields.push(field);
      return fallback;
    }
    return parsed;
  };

  // version 1이 첫 버전이라 아직 변환할 이전 버전이 없다. 구조가 바뀌면 여기서 변환한다.
  const schedule = pick('schedule', parseSchedule(raw.schedule), defaults.schedule);

  const offDays = pick(
    'offDays',
    Array.isArray(raw.offDays) &&
      raw.offDays.every((day) => typeof day === 'string' && DATE_KEY_PATTERN.test(day))
      ? (raw.offDays as string[])
      : null,
    defaults.offDays,
  );

  const skipDate =
    raw.skipDate === null ||
    (typeof raw.skipDate === 'string' && DATE_KEY_PATTERN.test(raw.skipDate))
      ? raw.skipDate
      : pick<string | null>('skipDate', undefined, defaults.skipDate);

  const nextIndex = pick(
    'nextIndex',
    typeof raw.nextIndex === 'number' && Number.isInteger(raw.nextIndex) && raw.nextIndex >= 0
      ? raw.nextIndex
      : null,
    defaults.nextIndex,
  );

  const volume = pick(
    'volume',
    typeof raw.volume === 'number' && raw.volume >= 0 && raw.volume <= 1 ? raw.volume : null,
    defaults.volume,
  );

  const autoLaunch = pick(
    'autoLaunch',
    typeof raw.autoLaunch === 'boolean' ? raw.autoLaunch : null,
    defaults.autoLaunch,
  );

  return {
    settings: {
      version: SETTINGS_VERSION,
      schedule,
      offDays,
      skipDate,
      nextIndex,
      volume,
      autoLaunch,
    },
    fixedFields,
  };
}

/** 화면에서 온 볼륨 값. 숫자가 아니면 null, 범위를 넘으면 0~1로 자른다. */
export function parseVolume(value: unknown): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return Math.min(1, Math.max(0, value));
}
