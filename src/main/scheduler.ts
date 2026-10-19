// Scheduler: 매초 판정 규칙(scheduler-rules)을 돌리고 그 결과대로 화면에 재생·정지를 지시한다.
// 특정 시각에 알람을 거는 방식(setTimeout)은 늦게 켜진 경우를 놓치므로 쓰지 않는다.
import { findNextPlay, getOffDayReason, type DayContext } from '../shared/day-rules';
import { findActiveSlot } from '../shared/schedule';
import { toDateKey } from '../shared/time';
import type {
  AppSettings,
  LibraryTrack,
  OffDayReason,
  PlayerStatus,
  ScheduleSlot,
  Track,
} from '../shared/types';
import {
  decideManualPlay,
  decidePlayTrack,
  decideStop,
  decideTick,
  findTrackIndex,
  getFollowingTrackId,
  getPreviousTrackId,
  INITIAL_SCHEDULER_STATE,
  toSlotKey,
  type Decision,
  type SchedulerState,
  type SlotKey,
} from './scheduler-rules';
import { logger } from './logger';

const TICK_INTERVAL_MS = 1000;

export interface SchedulerDeps {
  getTracks: () => readonly LibraryTrack[];
  getSettings: () => AppSettings;
  /** 공휴일 (HolidayProvider에서 받아 둔 것). */
  getHolidays: () => ReadonlyMap<string, string>;
  saveNextTrackId: (nextTrackId: string | null) => void;
  play: (track: Track) => void;
  stop: () => void;
  publishStatus: (status: PlayerStatus) => void;
  /** 테스트·디버그에서 시각을 바꿔 끼울 수 있게 주입받는다. */
  now?: () => Date;
}

export class Scheduler {
  private state: SchedulerState = INITIAL_SCHEDULER_STATE;
  private currentTrackId: string | null = null;
  /** 연달아 재생에 실패한 횟수. 곡 수만큼 실패하면 모든 파일이 문제라고 보고 멈춘다. */
  private consecutiveFailures = 0;
  private timer: NodeJS.Timeout | null = null;
  private lastStatusJson = '';
  /** 휴무일이라 건너뛴 구간 로그를 구간마다 한 번만 남기기 위함. */
  private lastSkipLogKey = '';

  constructor(private readonly deps: SchedulerDeps) {}

  /**
   * 화면이 (다시) 로드됐을 때 부른다. 화면의 소리는 이미 끊겼으므로 정지 상태로 맞추고 바로 판정한다.
   * 구간 안이면 다음 곡부터 다시 재생되고, 처음 호출이면 매초 판정을 시작한다.
   */
  resync(): void {
    this.state = INITIAL_SCHEDULER_STATE;
    this.currentTrackId = null;
    this.tick();
    this.timer ??= setInterval(() => this.tick(), TICK_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** 매초 판정. 설정·곡 목록이 바뀌어도 다음 판정에서 자연히 반영된다. */
  tick(): void {
    // 판정이 정지를 내리는 경우는 구간 종료이거나, 구간 중에 쉬는 날이 된 경우다.
    this.apply(
      decideTick(this.state, this.getActiveSlotKey(), this.deps.getTracks().length > 0),
      '구간 종료 또는 쉬는 날',
    );
  }

  requestPlay(): void {
    this.apply(
      decideManualPlay(this.state, this.getActiveSlotKey(), this.deps.getTracks().length > 0),
    );
  }

  requestStop(): void {
    this.apply(decideStop(this.state, this.getActiveSlotKey()), '정지 버튼');
  }

  /**
   * [다음 곡] 버튼. 재생 중일 때만 지금 곡을 건너뛴다. 모드(스케줄·수동)는 그대로라
   * 구간 끝 정지 규칙도 그대로 적용된다. 정지 상태에서 누르면(버튼은 숨겨지지만) 아무것도 안 함.
   */
  requestNext(): void {
    if (this.state.mode === 'idle') return;
    logger.info(`[scheduler] 다음 곡 버튼: ${this.currentTrackId ?? ''} 건너뜀`);
    this.consecutiveFailures = 0;
    this.playFollowing();
  }

  /** [이전 곡] 버튼. 재생 중일 때만 지금 곡 바로 위 곡으로 돌아간다 (모드는 그대로). */
  requestPrevious(): void {
    if (this.state.mode === 'idle') return;
    const ids = this.deps.getTracks().map((track) => track.id);
    const previous = getPreviousTrackId(ids, this.currentTrackId);
    if (previous === null) return;
    logger.info(`[scheduler] 이전 곡 버튼: ${previous}`);
    // 다음 곡을 이전 곡으로 바꿔 두고 시작하면 playNext가 그 곡을 튼다.
    this.deps.saveNextTrackId(previous);
    this.consecutiveFailures = 0;
    this.playNext();
  }

  /** 노래 목록에서 곡을 두 번 눌렀다 → 그 곡부터 재생 (재생 중이면 그 곡으로 바꿈). */
  requestPlayTrack(trackId: unknown): void {
    if (typeof trackId !== 'string' || !this.deps.getTracks().some((t) => t.id === trackId)) return;
    // 다음 곡을 고른 곡으로 바꿔 두고 시작하면 playNext가 그 곡을 튼다.
    this.deps.saveNextTrackId(trackId);
    logger.info(`[scheduler] 곡 선택: ${trackId}`);
    this.apply(decidePlayTrack(this.state, this.getActiveSlotKey()));
  }

  /**
   * 곡을 지우기 직전에 부른다. 그 곡이 재생 중이면 다음 곡으로 넘긴다
   * (Windows는 재생 중인 파일을 지우지 못하고, 지운 곡이 끝까지 나오는 것도 이상하다).
   */
  releaseTrack(trackId: string): void {
    const ids = this.deps.getTracks().map((track) => track.id);
    // 다음 곡이 지울 곡이면(곡이 하나뿐이거나 순서를 바꾼 경우) 그 아래 곡으로 미리 옮긴다.
    if (this.deps.getSettings().nextTrackId === trackId) {
      const following = getFollowingTrackId(ids, ids.indexOf(trackId));
      this.deps.saveNextTrackId(following === trackId ? null : following);
    }
    if (this.state.mode === 'idle' || this.currentTrackId !== trackId) return;
    if (ids.length <= 1) {
      this.apply(decideStop(this.state, this.getActiveSlotKey()), '재생 중인 곡 삭제');
      return;
    }
    this.playNext();
  }

  /**
   * "오늘은 재생 안 함"을 켜면 재생 중인 음악(수동 재생 포함)을 바로 멈춘다 (S-01).
   * 끄면 다음 판정에서 구간 안이면 다시 재생된다. 날짜 저장은 호출하는 쪽이 먼저 한다.
   */
  handleSkipTodayChanged(isSkipping: boolean): void {
    if (isSkipping) {
      this.apply(decideStop(this.state, null), '오늘은 재생 안 함');
    } else {
      this.tick();
    }
  }

  /** 곡이 끝남 → 다음 곡 (재생 중일 때만). 이전 곡의 늦은 알림은 무시한다. */
  handleEnded(trackId: unknown): void {
    if (this.state.mode === 'idle' || trackId !== this.currentTrackId) return;
    this.consecutiveFailures = 0;
    this.playFollowing();
  }

  /** 재생 실패(파일 없음·손상) → 다음 곡. 모든 곡이 실패하면 이번 구간은 포기한다. */
  handleError(trackId: unknown): void {
    if (this.state.mode === 'idle' || trackId !== this.currentTrackId) return;
    logger.warn(`[scheduler] 재생 실패, 다음 곡으로 넘깁니다: ${String(trackId)}`);
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= this.deps.getTracks().length) {
      this.apply(decideStop(this.state, this.getActiveSlotKey()), '모든 곡 재생 실패');
      return;
    }
    this.playFollowing();
  }

  /** 새벽 재시작 판단용: 지금 소리를 내고 있는지. */
  isIdle(): boolean {
    return this.state.mode === 'idle';
  }

  getStatus(): PlayerStatus {
    const now = this.now();
    const settings = this.deps.getSettings();
    const { schedule, nextTrackId } = settings;
    const tracks = this.deps.getTracks();
    const trackIds = tracks.map((track) => track.id);
    const context = this.getDayContext();
    const offDayReason = getOffDayReason(now, context);
    const activeSlot = offDayReason ? null : findActiveSlot(schedule, now);
    return {
      mode: this.state.mode,
      offDayReason,
      isSkippingToday: settings.skipDate === toDateKey(now),
      activeSlot,
      nextPlay: findNextPlay(schedule, now, context),
      currentTrackId: this.currentTrackId,
      nextTrackId: tracks[findTrackIndex(trackIds, nextTrackId)]?.id ?? null,
      isMissingTracks: activeSlot !== null && tracks.length === 0,
    };
  }

  private now(): Date {
    return this.deps.now?.() ?? new Date();
  }

  private getDayContext(): DayContext {
    const { offDays, skipDate } = this.deps.getSettings();
    return { holidays: this.deps.getHolidays(), offDays, skipDate };
  }

  /**
   * 지금 재생해야 하는 구간의 키. 쉬는 날이면 구간 안이어도 null (= 재생하지 않음).
   * 매초 그 시점의 날짜로 다시 판정하므로 며칠을 켜 둬도 날짜가 바뀌면 바로 반영된다 (NFR-02).
   */
  private getActiveSlotKey(): SlotKey {
    const now = this.now();
    const slot = findActiveSlot(this.deps.getSettings().schedule, now);
    const offDayReason = slot ? getOffDayReason(now, this.getDayContext()) : null;
    if (slot && offDayReason) {
      this.logSkippedSlot(toDateKey(now), slot, offDayReason);
      return null;
    }
    return toSlotKey(toDateKey(now), slot);
  }

  private logSkippedSlot(dateKey: string, slot: ScheduleSlot, reason: OffDayReason): void {
    const key = toSlotKey(dateKey, slot) ?? '';
    if (key === this.lastSkipLogKey) return;
    this.lastSkipLogKey = key;
    const detail = reason.kind === 'holiday' ? `holiday:${reason.name}` : reason.kind;
    logger.info(`[scheduler] 휴무일이라 건너뜀: ${dateKey} ${slot.name} (${detail})`);
  }

  /** 판정 결과를 실행한다. stopReason은 정지할 때 로그에 남길 이유. */
  private apply(decision: Decision, stopReason = ''): void {
    this.state = decision.state;
    if (decision.action === 'start') {
      this.consecutiveFailures = 0;
      this.playNext();
    } else if (decision.action === 'stop') {
      this.currentTrackId = null;
      logger.info(`[scheduler] 정지 (${stopReason})`);
      this.deps.stop();
    }
    this.publishStatusIfChanged();
  }

  /**
   * 지금 곡 다음으로 넘어간다 (곡 끝, 재생 실패, [다음 곡] 버튼).
   * 곡이 하나일 때 시작하면 다음 곡이 그 곡 자신으로 저장된다. 그 뒤 곡이 늘었으면
   * 같은 곡을 또 틀지 않고 그 아래 곡으로 넘긴다.
   */
  private playFollowing(): void {
    const ids = this.deps.getTracks().map((track) => track.id);
    const index = this.currentTrackId === null ? -1 : ids.indexOf(this.currentTrackId);
    if (
      index !== -1 &&
      ids.length > 1 &&
      this.deps.getSettings().nextTrackId === this.currentTrackId
    ) {
      this.deps.saveNextTrackId(getFollowingTrackId(ids, index));
    }
    this.playNext();
  }

  /**
   * 저장된 다음 곡(nextTrackId)을 틀고, 그 아래 곡을 바로 다음 곡으로 저장한다.
   * 곡이 시작될 때 저장해 두면 구간 종료로 끊기든 앱이 갑자기 꺼지든 다음 곡부터 이어진다 (FR-04·05).
   */
  private playNext(): void {
    const tracks = this.deps.getTracks();
    if (tracks.length === 0) {
      this.apply(decideStop(this.state, this.getActiveSlotKey()), '재생할 곡 없음');
      return;
    }
    const ids = tracks.map((t) => t.id);
    const index = findTrackIndex(ids, this.deps.getSettings().nextTrackId);
    const track = tracks[index];
    this.currentTrackId = track.id;
    this.deps.saveNextTrackId(getFollowingTrackId(ids, index));
    const slotName = findActiveSlot(this.deps.getSettings().schedule, this.now())?.name;
    const where = this.state.mode === 'manual' ? '직접 재생' : (slotName ?? '구간');
    logger.info(`[scheduler] 재생 시작: ${track.id} (${where})`);
    this.deps.play({ id: track.id, title: track.title, url: track.url });
    this.publishStatusIfChanged();
  }

  private publishStatusIfChanged(): void {
    const status = this.getStatus();
    const json = JSON.stringify(status);
    if (json === this.lastStatusJson) return;
    this.lastStatusJson = json;
    this.deps.publishStatus(status);
  }
}
