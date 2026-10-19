// settings.json 구조 검사. 파일 내용은 그대로 믿지 않고(손으로 고쳤거나 깨졌을 수 있음)
// 항목마다 검사해서 틀린 항목만 기본값으로 바꾼다. 파일이 깨져도 앱이 멈추지 않게 하기 위함.
import { DEFAULT_SCHEDULE, validateSchedule } from '../shared/schedule';
import type { AppSettings, ScheduleSlot } from '../shared/types';

export const SETTINGS_VERSION = 2;
/** 1.0.0의 설정 버전. 다음 곡을 번호(nextIndex)로 저장했고 재생 순서는 파일 이름순이었다. */
const LEGACY_VERSION = 1;

export function createDefaultSettings(): AppSettings {
  return {
    version: SETTINGS_VERSION,
    schedule: DEFAULT_SCHEDULE.map((slot) => ({ ...slot })),
    offDays: [],
    skipDate: null,
    trackOrder: [],
    nextTrackId: null,
    volume: 0.8,
    autoLaunch: true,
  };
}

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
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
  /** 1.0.0 설정을 변환했다 (새 버전으로 다시 저장해야 함). */
  isMigrated: boolean;
  /**
   * 1.0.0 설정의 다음 곡 번호. 번호를 곡 이름으로 바꾸려면 곡 목록이 필요해서
   * 여기서는 그대로 넘기고, 음악 폴더를 읽은 뒤 migrateNextIndex로 바꾼다.
   */
  legacyNextIndex: number | null;
}

export function parseSettings(raw: unknown): ParsedSettings {
  const defaults = createDefaultSettings();
  if (!isRecord(raw)) {
    return {
      settings: defaults,
      fixedFields: ['(전체)'],
      isMigrated: false,
      legacyNextIndex: null,
    };
  }
  const isLegacy = raw.version === LEGACY_VERSION;

  const fixedFields: string[] = [];
  const pick = <T>(field: keyof AppSettings, parsed: T | null | undefined, fallback: T): T => {
    if (parsed === null || parsed === undefined) {
      fixedFields.push(field);
      return fallback;
    }
    return parsed;
  };

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

  // 1.0.0 설정에는 아래 두 항목이 원래 없다. 비어 있는 게 정상이므로 "고친 항목"으로 세지 않는다.
  // 순서가 비어 있으면 음악 폴더를 읽을 때 모든 곡이 새 곡 → 이름순이 되어 1.0.0의 순서와 같다.
  const trackOrder =
    Array.isArray(raw.trackOrder) && raw.trackOrder.every(isNonEmptyString)
      ? (raw.trackOrder as string[])
      : isLegacy
        ? defaults.trackOrder
        : pick<string[]>('trackOrder', null, defaults.trackOrder);

  const nextTrackId =
    raw.nextTrackId === null || isNonEmptyString(raw.nextTrackId)
      ? raw.nextTrackId
      : isLegacy
        ? defaults.nextTrackId
        : pick<string | null>('nextTrackId', undefined, defaults.nextTrackId);

  const legacyNextIndex =
    isLegacy &&
    typeof raw.nextIndex === 'number' &&
    Number.isInteger(raw.nextIndex) &&
    raw.nextIndex >= 0
      ? raw.nextIndex
      : null;

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
      trackOrder,
      nextTrackId,
      volume,
      autoLaunch,
    },
    fixedFields,
    isMigrated: isLegacy,
    legacyNextIndex,
  };
}

/** 화면에서 온 볼륨 값. 숫자가 아니면 null, 범위를 넘으면 0~1로 자른다. */
export function parseVolume(value: unknown): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return Math.min(1, Math.max(0, value));
}

/**
 * 1.0.0의 다음 곡 번호를 곡 이름으로 바꾼다. trackIds는 이름순 목록(1.0.0과 같은 순서).
 * 번호가 곡 수를 넘으면(곡을 지운 경우 등) 1.0.0처럼 첫 곡부터.
 */
export function migrateNextIndex(index: number, trackIds: readonly string[]): string | null {
  if (trackIds.length === 0) return null;
  return trackIds[Number.isInteger(index) && index >= 0 && index < trackIds.length ? index : 0];
}
