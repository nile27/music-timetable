// 실제 소리를 내는 부분. 언제·무엇을 틀지는 메인이 정하고, 여기서는 지시대로만 움직인다.
// 곡이 끝나거나 실패하면 메인에 알리기만 한다 (다음 곡은 메인이 정함).
import type { Track } from '../shared/types';

export interface AudioPlayerCallbacks {
  onEnded: (trackId: string) => void;
  onError: (trackId: string) => void;
}

export class AudioPlayer {
  private readonly audio = new Audio();
  private currentTrackId: string | null = null;

  constructor(callbacks: AudioPlayerCallbacks) {
    this.audio.addEventListener('ended', () => {
      if (this.currentTrackId) callbacks.onEnded(this.currentTrackId);
    });
    // 파일이 지워졌거나 깨진 경우. stop()에서 src를 비울 때는 currentTrackId가 null이라 무시된다.
    this.audio.addEventListener('error', () => {
      if (this.currentTrackId) callbacks.onError(this.currentTrackId);
    });
    this.onPlayRejected = (error: unknown) => {
      // 재생 시작 전에 정지하면 play()가 AbortError로 끝난다. 실패가 아니므로 무시한다.
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error('[player] play failed', error);
      if (this.currentTrackId) callbacks.onError(this.currentTrackId);
    };
  }

  private readonly onPlayRejected: (error: unknown) => void;

  play(track: Track): void {
    this.currentTrackId = track.id;
    this.audio.src = track.url;
    this.audio.play().catch(this.onPlayRejected);
  }

  stop(): void {
    this.currentTrackId = null;
    this.audio.pause();
    // src를 비워야 파일 스트림이 닫혀 다음 재생 때 처음부터 새로 받는다.
    this.audio.removeAttribute('src');
    this.audio.load();
  }

  /** 0~1 */
  setVolume(volume: number): void {
    this.audio.volume = Math.min(1, Math.max(0, volume));
  }
}
