// 실제 소리를 내는 부분. 언제·무엇을 틀지는 메인이 정하고, 여기서는 지시대로만 움직인다.
import type { Track } from '../shared/types';

export class AudioPlayer {
  private readonly audio = new Audio();

  async play(track: Track): Promise<void> {
    this.audio.src = track.url;
    await this.audio.play();
  }

  stop(): void {
    this.audio.pause();
    // src를 비워야 파일 스트림이 닫혀 다음 재생 때 처음부터 새로 받는다.
    this.audio.removeAttribute('src');
    this.audio.load();
  }
}
