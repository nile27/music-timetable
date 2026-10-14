// 화면 ↔ 메인 IPC 처리. 화면에서 온 값은 믿지 않고 여기서 다시 검사한다 (컨벤션 5장).
import { ipcMain, shell } from 'electron';
import { isWeekend, parseDateKey } from '../shared/day-rules';
import { IPC } from '../shared/ipc-channels';
import { normalizeSchedule, validateSchedule } from '../shared/schedule';
import { toDateKey } from '../shared/time';
import type { HolidayData, SaveScheduleResult, ScheduleSlot } from '../shared/types';
import { toHolidayMap } from './holiday-provider';
import type { MusicLibrary } from './library';
import { logger } from './logger';
import type { Scheduler } from './scheduler';
import type { SettingsStore } from './settings';
import { parseVolume } from './settings-rules';
import { applyAutoLaunch } from './system';

export interface AppServices {
  library: MusicLibrary;
  settings: SettingsStore;
  scheduler: Scheduler;
  holidayData: HolidayData;
  musicDir: string;
}

/** 화면에서 온 값: 문자열 배열인지 확인한다. */
function toPathList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

/** 화면에서 온 시간표 배열을 ScheduleSlot[]로. 항목 형식이 틀리면 null. */
function parseScheduleInput(value: unknown[]): ScheduleSlot[] | null {
  const slots: ScheduleSlot[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) return null;
    const { name, start, end } = item as Record<string, unknown>;
    if (typeof name !== 'string' || typeof start !== 'string' || typeof end !== 'string') {
      return null;
    }
    slots.push({ name, start, end });
  }
  return slots;
}

export function registerIpcHandlers(services: AppServices): void {
  const { library, settings, scheduler, holidayData, musicDir } = services;
  const holidayMap = toHolidayMap(holidayData);

  // 무엇을 틀지는 메인(스케줄러)이 정한다 (판단은 main, 소리는 renderer).
  ipcMain.on(IPC.PLAYER_REQUEST_PLAY, () => scheduler.requestPlay());
  ipcMain.on(IPC.PLAYER_REQUEST_STOP, () => scheduler.requestStop());
  ipcMain.on(IPC.PLAYER_ENDED, (_event, trackId: unknown) => scheduler.handleEnded(trackId));
  ipcMain.on(IPC.PLAYER_ERROR, (_event, trackId: unknown) => scheduler.handleError(trackId));
  ipcMain.handle(IPC.STATUS_GET, () => scheduler.getStatus());

  ipcMain.handle(IPC.SETTINGS_GET, () => settings.get());
  ipcMain.handle(IPC.SETTINGS_SAVE, async (_event, value: unknown): Promise<SaveScheduleResult> => {
    // 화면에서도 검사하지만 메인이 다시 검사한다.
    const schedule = Array.isArray(value) ? parseScheduleInput(value) : null;
    if (!schedule) return { ok: false, issues: [] };
    const issues = validateSchedule(schedule);
    if (issues.length > 0) return { ok: false, issues };
    await settings.save({ schedule: normalizeSchedule(schedule) });
    logger.info('[settings] 시간표 저장', JSON.stringify(settings.get().schedule));
    // 바뀐 시간표로 바로 판정해 화면 상태를 갱신한다 (다음 1초를 기다리지 않음).
    scheduler.tick();
    return { ok: true, settings: settings.get() };
  });
  ipcMain.on(IPC.SETTINGS_SET_VOLUME, (_event, value: unknown) => {
    const volume = parseVolume(value);
    if (volume !== null) void settings.save({ volume });
  });
  ipcMain.on(IPC.SETTINGS_SET_AUTO_LAUNCH, (_event, value: unknown) => {
    if (typeof value !== 'boolean') return;
    void settings.save({ autoLaunch: value });
    applyAutoLaunch(value);
  });

  ipcMain.on(IPC.DAY_SKIP_TODAY, (_event, value: unknown) => {
    if (typeof value !== 'boolean') return;
    // 오늘 날짜를 저장해 두면 날짜가 바뀌는 순간 판정에서 빠지므로 "다음 날 자동 해제"가 된다.
    void settings.save({ skipDate: value ? toDateKey(new Date()) : null });
    logger.info(`[day] 오늘은 재생 안 함: ${value ? '켜짐' : '꺼짐'}`);
    scheduler.handleSkipTodayChanged(value);
  });
  ipcMain.handle(IPC.DAY_TOGGLE_OFF_DAY, async (_event, value: unknown): Promise<string[]> => {
    const { offDays } = settings.get();
    // 주말·공휴일은 원래 쉬므로 지정 대상이 아니다 (달력에서도 누를 수 없게 막지만 다시 검사).
    const date = typeof value === 'string' ? parseDateKey(value) : null;
    if (!date || isWeekend(date) || holidayMap.has(value as string)) return offDays;
    const dateKey = value as string;
    const next = offDays.includes(dateKey)
      ? offDays.filter((day) => day !== dateKey)
      : [...offDays, dateKey].sort();
    await settings.save({ offDays: next });
    logger.info(`[day] 쉬는 날 ${offDays.includes(dateKey) ? '해제' : '지정'}: ${dateKey}`);
    scheduler.tick();
    return next;
  });
  ipcMain.handle(IPC.DAY_HOLIDAYS, () => holidayData);

  ipcMain.handle(IPC.LIBRARY_LIST, () => library.getTracks());
  ipcMain.handle(IPC.LIBRARY_ADD, (_event, paths: unknown) => library.addFiles(toPathList(paths)));
  ipcMain.on(IPC.LIBRARY_OPEN_FOLDER, () => {
    void shell.openPath(musicDir).then((error) => {
      if (error) logger.warn(`[library] 폴더를 열지 못했습니다: ${error}`);
    });
  });
}
