import './style.css';
import { MESSAGES } from './messages';
import { AudioPlayer } from './player';
import { setupLibraryView } from './library-view';

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`#${id} element not found`);
  return element as T;
}

function init(): void {
  const playButton = getElement<HTMLButtonElement>('play-button');
  const stopButton = getElement<HTMLButtonElement>('stop-button');
  const status = getElement<HTMLParagraphElement>('status');
  const player = new AudioPlayer();

  document.title = MESSAGES.appTitle;
  playButton.textContent = MESSAGES.play;
  stopButton.textContent = MESSAGES.stop;
  status.textContent = MESSAGES.statusStopped;

  // 버튼은 메인에 요청만 보낸다. 실제 재생·정지는 메인의 지시(onPlay/onStop)로 일어난다.
  playButton.addEventListener('click', () => window.api.requestPlay());
  stopButton.addEventListener('click', () => window.api.requestStop());

  window.api.onPlay((track) => {
    player
      .play(track)
      .then(() => {
        status.textContent = MESSAGES.statusPlaying(track.title);
      })
      .catch((error: unknown) => {
        console.error('[player] play failed', error);
        status.textContent = MESSAGES.playFailed;
      });
  });

  window.api.onStop(() => {
    player.stop();
    status.textContent = MESSAGES.statusStopped;
  });

  setupLibraryView({
    dropZone: getElement('drop-zone'),
    dropMessage: getElement('drop-message'),
    count: getElement('track-count'),
    openFolderButton: getElement<HTMLButtonElement>('open-folder-button'),
    list: getElement<HTMLUListElement>('track-list'),
    empty: getElement('empty-library'),
  });
}

init();
