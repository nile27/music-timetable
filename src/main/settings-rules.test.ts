import { describe, expect, it } from 'vitest';
import {
  createDefaultSettings,
  migrateNextIndex,
  parseSchedule,
  parseSettings,
  parseVolume,
} from './settings-rules';

describe('parseSettings', () => {
  it('정상 파일은 그대로 읽는다', () => {
    const saved = {
      version: 2,
      schedule: [{ name: '아침', start: '08:00', end: '08:20' }],
      offDays: ['2026-12-24'],
      skipDate: '2026-10-14',
      trackOrder: ['b.mp3', 'a.mp3'],
      nextTrackId: 'a.mp3',
      volume: 0.5,
      autoLaunch: false,
    };
    expect(parseSettings(saved)).toEqual({
      settings: saved,
      fixedFields: [],
      isMigrated: false,
      legacyNextIndex: null,
    });
  });

  it.each([null, 'text', 42, []])('객체가 아니면(%j) 전체 기본값', (raw) => {
    expect(parseSettings(raw)).toEqual({
      settings: createDefaultSettings(),
      fixedFields: ['(전체)'],
      isMigrated: false,
      legacyNextIndex: null,
    });
  });

  it('빈 객체는 모든 항목을 기본값으로 채운다 (version 없는 옛 파일 포함)', () => {
    const { settings, fixedFields } = parseSettings({});
    expect(settings).toEqual(createDefaultSettings());
    expect(fixedFields).toEqual([
      'schedule',
      'offDays',
      'skipDate',
      'trackOrder',
      'nextTrackId',
      'volume',
      'autoLaunch',
    ]);
  });

  it('틀린 항목만 기본값으로 바꾸고 나머지는 유지한다', () => {
    const { settings, fixedFields } = parseSettings({
      ...createDefaultSettings(),
      trackOrder: ['a.mp3', 3],
      nextTrackId: 7,
      volume: 3,
      skipDate: 'tomorrow',
      offDays: ['2026/12/24'],
    });
    expect(settings.trackOrder).toEqual([]);
    expect(settings.nextTrackId).toBeNull();
    expect(settings.volume).toBe(0.8);
    expect(settings.skipDate).toBeNull();
    expect(settings.offDays).toEqual([]);
    expect(fixedFields).toEqual(['offDays', 'skipDate', 'trackOrder', 'nextTrackId', 'volume']);
  });

  it('빈 시간표는 사용자가 다 지운 것이므로 유지한다', () => {
    expect(parseSettings({ ...createDefaultSettings(), schedule: [] }).settings.schedule).toEqual(
      [],
    );
  });
});

describe('1.0.0 설정(version 1) 변환', () => {
  const legacy = {
    version: 1,
    schedule: [{ name: '아침', start: '08:00', end: '08:20' }],
    offDays: ['2026-12-24'],
    skipDate: null,
    nextIndex: 3,
    volume: 0.5,
    autoLaunch: false,
  };

  it('다른 항목은 유지하고 version 2로 바꾼다. 없던 항목은 고친 항목으로 세지 않는다', () => {
    const { settings, fixedFields, isMigrated, legacyNextIndex } = parseSettings(legacy);
    expect(settings).toEqual({
      version: 2,
      schedule: legacy.schedule,
      offDays: legacy.offDays,
      skipDate: null,
      trackOrder: [],
      nextTrackId: null,
      volume: 0.5,
      autoLaunch: false,
    });
    expect(settings).not.toHaveProperty('nextIndex');
    expect(fixedFields).toEqual([]);
    expect(isMigrated).toBe(true);
    expect(legacyNextIndex).toBe(3);
  });

  it.each([-1, 1.5, '3'])('곡 번호가 틀리면(%j) 넘기지 않는다', (nextIndex) => {
    expect(parseSettings({ ...legacy, nextIndex }).legacyNextIndex).toBeNull();
  });

  it('version 2 파일의 nextIndex는 무시한다', () => {
    expect(parseSettings({ ...createDefaultSettings(), nextIndex: 3 }).legacyNextIndex).toBeNull();
  });
});

describe('migrateNextIndex', () => {
  const IDS = ['01.mp3', '02.mp3', '03.mp3'];

  it('번호 → 그 번호의 곡 이름', () => {
    expect(migrateNextIndex(1, IDS)).toBe('02.mp3');
  });

  it('곡 수를 넘으면 첫 곡 (1.0.0과 같은 규칙)', () => {
    expect(migrateNextIndex(3, IDS)).toBe('01.mp3');
  });

  it('곡이 없으면 null', () => {
    expect(migrateNextIndex(0, [])).toBeNull();
  });
});

describe('parseSchedule', () => {
  it('항목 하나라도 형식이 틀리면 null', () => {
    expect(parseSchedule([{ name: 'A', start: '08:00' }])).toBeNull();
    expect(parseSchedule([{ name: 1, start: '08:00', end: '09:00' }])).toBeNull();
    expect(parseSchedule('08:00-09:00')).toBeNull();
  });

  it('겹치거나 거꾸로 된 시간표는 null', () => {
    expect(
      parseSchedule([
        { name: 'A', start: '08:00', end: '09:00' },
        { name: 'B', start: '08:30', end: '09:30' },
      ]),
    ).toBeNull();
    expect(parseSchedule([{ name: 'A', start: '09:00', end: '08:00' }])).toBeNull();
  });

  it('여분의 필드는 버린다', () => {
    expect(parseSchedule([{ name: 'A', start: '08:00', end: '09:00', extra: true }])).toEqual([
      { name: 'A', start: '08:00', end: '09:00' },
    ]);
  });
});

describe('parseVolume', () => {
  it('0~1로 자른다', () => {
    expect(parseVolume(0.3)).toBe(0.3);
    expect(parseVolume(-1)).toBe(0);
    expect(parseVolume(2)).toBe(1);
  });

  it.each(['0.5', null, Number.NaN])('숫자가 아니면(%j) null', (value) => {
    expect(parseVolume(value)).toBeNull();
  });
});
