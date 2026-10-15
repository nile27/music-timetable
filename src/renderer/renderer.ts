// 화면 전체 연결. 메인에서 오는 상태·곡 목록을 받아 각 화면에 나눠 준다.
import './styles/tokens.css';
import './styles/base.css';
import './styles/play.css';
import './styles/schedule.css';
import './styles/songs.css';
import './styles/settings.css';
import type { LibraryTrack, PlayerStatus } from '../shared/types';
import { getCoverBackground } from './cover';
import { el } from './dom';
import { setupLibraryView } from './library-view';
import { MESSAGES } from './messages';
import { setupOffDayCalendar } from './off-day-calendar';
import { buildPlayViewModel } from './play-state';
import { setupPlayView } from './play-view';
import { AudioPlayer } from './player';
import { setupScheduleEditor } from './schedule-editor';
import { setupSettingsPanel } from './settings-panel';
import { setupShell } from './shell';

// "32분 남음" 같은 남은 시간은 상태가 바뀌지 않아도 줄어드므로 주기적으로 다시 그린다.
const CLOCK_REFRESH_MS = 15_000;

function getElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`#${id} element not found`);
  return element;
}

function init(): void {
  document.title = MESSAGES.appTitle;

  const shell = setupShell(getElement('app'), getElement('nav'));
  const player = new AudioPlayer({
    onEnded: (trackId) => window.api.notifyEnded(trackId),
    onError: (trackId) => window.api.notifyError(trackId),
    onProgress: (currentTime, duration) => playView.setProgress(currentTime, duration),
  });
  const playView = setupPlayView(getElement('view-play'), {
    onVolumeInput: (volume) => player.setVolume(volume),
  });

  const scheduleView = getElement('view-schedule');
  scheduleView.append(
    el('h1', 'page-title', MESSAGES.scheduleTitle),
    el('p', 'page-subtitle', MESSAGES.scheduleSubtitle),
  );
  const scheduleBody = el('div', 'schedule-body');
  scheduleView.append(scheduleBody);
  setupScheduleEditor(scheduleBody);
  setupOffDayCalendar(scheduleBody);

  const library = setupLibraryView(getElement('view-songs'));
  setupSettingsPanel(getElement('view-settings'));

  let tracks: readonly LibraryTrack[] = [];
  let status: PlayerStatus | null = null;

  const refresh = (): void => {
    if (!status) return;
    const viewModel = buildPlayViewModel(status, tracks, new Date());
    shell.setTone(viewModel.tone);
    shell.setMiniStatus(viewModel.pill, viewModel.miniText);
    shell.setBackground(
      getCoverBackground(viewModel.track?.coverUrl ?? null, viewModel.track?.id ?? ''),
    );
    playView.render(viewModel, status.isSkippingToday);
    library.setMarks(viewModel.isSounding ? status.currentTrackId : null, status.nextTrackId);
  };

  // 재생·정지는 메인의 지시로만 일어난다 (판단은 main, 소리는 renderer).
  window.api.onPlay((track) => player.play(track));
  window.api.onStop(() => player.stop());

  window.api.onStatus((next) => {
    status = next;
    refresh();
  });
  window.api.onLibraryChanged((next) => {
    tracks = next;
    library.render(tracks);
    refresh();
  });
  void Promise.all([
    window.api.listTracks(),
    window.api.getStatus(),
    window.api.getSettings(),
  ]).then(([initialTracks, initialStatus, settings]) => {
    tracks = initialTracks;
    status = initialStatus;
    library.render(tracks);
    player.setVolume(settings.volume);
    playView.setVolume(settings.volume);
    refresh();
  });
  window.setInterval(refresh, CLOCK_REFRESH_MS);
}

init();
