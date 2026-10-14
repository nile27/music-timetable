import './style.css';
import type { PlayerStatus } from '../shared/types';
import { setupLibraryView } from './library-view';
import { MESSAGES } from './messages';
import { AudioPlayer } from './player';
import { setupScheduleEditor } from './schedule-editor';

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`#${id} element not found`);
  return element as T;
}

/** 상태 줄 문구 (NFR-05: 지금 무엇을 하는지, 다음에 언제 트는지 항상 보이게). */
function describeStatus(status: PlayerStatus): string {
  if (status.mode === 'playing' && status.activeSlot) {
    return MESSAGES.statusPlayingSlot(status.activeSlot);
  }
  if (status.mode === 'manual') return MESSAGES.statusManual;
  if (status.isMissingTracks) return MESSAGES.statusNoTracks;

  const next = status.nextSlot
    ? MESSAGES.statusNext(status.nextSlot.slot, status.nextSlot.isTomorrow)
    : MESSAGES.statusNoSchedule;
  return status.activeSlot ? `${MESSAGES.statusStoppedInSlot(status.activeSlot)}\n${next}` : next;
}

function init(): void {
  const playButton = getElement<HTMLButtonElement>('play-button');
  const stopButton = getElement<HTMLButtonElement>('stop-button');
  const statusText = getElement('status');
  const nowPlaying = getElement('now-playing');
  const volumeLabel = getElement('volume-label');
  const volumeSlider = getElement<HTMLInputElement>('volume-slider');

  document.title = MESSAGES.appTitle;
  playButton.textContent = MESSAGES.play;
  stopButton.textContent = MESSAGES.stop;
  volumeLabel.textContent = MESSAGES.volume;

  const player = new AudioPlayer({
    onEnded: (trackId) => window.api.notifyEnded(trackId),
    onError: (trackId) => window.api.notifyError(trackId),
  });

  // 버튼은 메인에 요청만 보낸다. 실제 재생·정지는 메인의 지시(onPlay/onStop)로 일어난다.
  playButton.addEventListener('click', () => window.api.requestPlay());
  stopButton.addEventListener('click', () => window.api.requestStop());

  window.api.onPlay((track) => {
    player.play(track);
    nowPlaying.textContent = MESSAGES.nowPlaying(track.title);
  });
  window.api.onStop(() => {
    player.stop();
    nowPlaying.textContent = '';
  });

  // 끄는 동안(input)은 소리에만 반영하고, 손을 뗄 때(change) 저장한다 (FR-08).
  volumeSlider.addEventListener('input', () => player.setVolume(Number(volumeSlider.value) / 100));
  volumeSlider.addEventListener('change', () =>
    window.api.setVolume(Number(volumeSlider.value) / 100),
  );
  void window.api.getSettings().then((settings) => {
    volumeSlider.value = String(Math.round(settings.volume * 100));
    player.setVolume(settings.volume);
  });

  const library = setupLibraryView({
    dropZone: getElement('drop-zone'),
    dropMessage: getElement('drop-message'),
    count: getElement('track-count'),
    openFolderButton: getElement<HTMLButtonElement>('open-folder-button'),
    list: getElement<HTMLUListElement>('track-list'),
    empty: getElement('empty-library'),
  });

  const renderStatus = (status: PlayerStatus): void => {
    statusText.textContent = describeStatus(status);
    library.setNextTrackId(status.nextTrackId);
  };
  void window.api.getStatus().then(renderStatus);
  window.api.onStatus(renderStatus);

  setupScheduleEditor({
    title: getElement('schedule-title'),
    rows: getElement('schedule-rows'),
    addButton: getElement<HTMLButtonElement>('add-slot-button'),
    saveButton: getElement<HTMLButtonElement>('save-schedule-button'),
    message: getElement('schedule-message'),
  });
}

init();
