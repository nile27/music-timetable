import { describe, expect, it } from 'vitest';
import { createDefaultSettings, parseSchedule, parseSettings, parseVolume } from './settings-rules';

describe('parseSettings', () => {
  it('정상 파일은 그대로 읽는다', () => {
    const saved = {
      version: 1,
      schedule: [{ name: '아침', start: '08:00', end: '08:20' }],
      offDays: ['2026-12-24'],
      skipDate: '2026-10-14',
      nextIndex: 3,
      volume: 0.5,
      autoLaunch: false,
    };
    expect(parseSettings(saved)).toEqual({ settings: saved, fixedFields: [] });
  });

  it.each([null, 'text', 42, []])('객체가 아니면(%j) 전체 기본값', (raw) => {
    expect(parseSettings(raw)).toEqual({
      settings: createDefaultSettings(),
      fixedFields: ['(전체)'],
    });
  });

  it('빈 객체는 모든 항목을 기본값으로 채운다 (version 없는 옛 파일 포함)', () => {
    const { settings, fixedFields } = parseSettings({});
    expect(settings).toEqual(createDefaultSettings());
    expect(fixedFields).toEqual([
      'schedule',
      'offDays',
      'skipDate',
      'nextIndex',
      'volume',
      'autoLaunch',
    ]);
  });

  it('틀린 항목만 기본값으로 바꾸고 나머지는 유지한다', () => {
    const { settings, fixedFields } = parseSettings({
      ...createDefaultSettings(),
      nextIndex: -1,
      volume: 3,
      skipDate: 'tomorrow',
      offDays: ['2026/12/24'],
    });
    expect(settings.nextIndex).toBe(0);
    expect(settings.volume).toBe(0.8);
    expect(settings.skipDate).toBeNull();
    expect(settings.offDays).toEqual([]);
    expect(fixedFields).toEqual(['offDays', 'skipDate', 'nextIndex', 'volume']);
  });

  it('빈 시간표는 사용자가 다 지운 것이므로 유지한다', () => {
    expect(parseSettings({ ...createDefaultSettings(), schedule: [] }).settings.schedule).toEqual(
      [],
    );
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
