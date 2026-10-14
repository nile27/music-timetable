// Scheduler: 매초 판정 규칙(scheduler-rules)을 돌리고 그 결과대로 화면에 재생·정지를 지시한다.
// 특정 시각에 알람을 거는 방식(setTimeout)은 늦게 켜진 경우를 놓치므로 쓰지 않는다.
import { findActiveSlot, findNextSlot } from '../shared/schedule';
import { toDateKey } from '../shared/time';
import type { AppSettings, LibraryTrack, PlayerStatus, Track } from '../shared/types';
import {
  decideManualPlay,
  decideStop,
  decideTick,
  getNextIndex,
  INITIAL_SCHEDULER_STATE,
  normalizeIndex,
  toSlotKey,
  type Decision,
  type SchedulerState,
  type SlotKey,
} from './scheduler-rules';

const TICK_INTERVAL_MS = 1000;

export interface SchedulerDeps {
  getTracks: () => readonly LibraryTrack[];
  getSettings: () => AppSettings;
  saveNextIndex: (nextIndex: number) => void;
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
    this.apply(decideTick(this.state, this.getActiveSlotKey(), this.deps.getTracks().length > 0));
  }

  requestPlay(): void {
    this.apply(
      decideManualPlay(this.state, this.getActiveSlotKey(), this.deps.getTracks().length > 0),
    );
  }

  requestStop(): void {
    this.apply(decideStop(this.state, this.getActiveSlotKey()));
  }

  /** 곡이 끝남 → 다음 곡 (재생 중일 때만). 이전 곡의 늦은 알림은 무시한다. */
  handleEnded(trackId: unknown): void {
    if (this.state.mode === 'idle' || trackId !== this.currentTrackId) return;
    this.consecutiveFailures = 0;
    this.playNext();
  }

  /** 재생 실패(파일 없음·손상) → 다음 곡. 모든 곡이 실패하면 이번 구간은 포기한다. */
  handleError(trackId: unknown): void {
    if (this.state.mode === 'idle' || trackId !== this.currentTrackId) return;
    console.warn(`[scheduler] 재생 실패, 다음 곡으로 넘깁니다: ${String(trackId)}`);
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= this.deps.getTracks().length) {
      console.warn('[scheduler] 모든 곡이 재생에 실패해서 이번 구간은 정지합니다');
      this.apply(decideStop(this.state, this.getActiveSlotKey()));
      return;
    }
    this.playNext();
  }

  getStatus(): PlayerStatus {
    const now = this.now();
    const { schedule, nextIndex } = this.deps.getSettings();
    const tracks = this.deps.getTracks();
    const activeSlot = findActiveSlot(schedule, now);
    return {
      mode: this.state.mode,
      activeSlot,
      nextSlot: findNextSlot(schedule, now),
      currentTrackId: this.currentTrackId,
      nextTrackId: tracks[normalizeIndex(nextIndex, tracks.length)]?.id ?? null,
      isMissingTracks: activeSlot !== null && tracks.length === 0,
    };
  }

  private now(): Date {
    return this.deps.now?.() ?? new Date();
  }

  private getActiveSlotKey(): SlotKey {
    const now = this.now();
    return toSlotKey(toDateKey(now), findActiveSlot(this.deps.getSettings().schedule, now));
  }

  private apply(decision: Decision): void {
    this.state = decision.state;
    if (decision.action === 'start') {
      this.consecutiveFailures = 0;
      this.playNext();
    } else if (decision.action === 'stop') {
      this.currentTrackId = null;
      this.deps.stop();
    }
    this.publishStatusIfChanged();
  }

  /**
   * 저장된 nextIndex 곡을 틀고, 그 다음 번호를 바로 저장한다.
   * 곡이 시작될 때 저장해 두면 구간 종료로 끊기든 앱이 갑자기 꺼지든 다음 곡부터 이어진다 (FR-04·05).
   */
  private playNext(): void {
    const tracks = this.deps.getTracks();
    if (tracks.length === 0) {
      this.apply(decideStop(this.state, this.getActiveSlotKey()));
      return;
    }
    const index = normalizeIndex(this.deps.getSettings().nextIndex, tracks.length);
    const track = tracks[index];
    this.currentTrackId = track.id;
    this.deps.saveNextIndex(getNextIndex(index, tracks.length));
    console.info(`[scheduler] 재생: ${track.id} (${this.state.mode})`);
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
