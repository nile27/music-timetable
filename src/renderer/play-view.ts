// 재생 화면 (S-01, Figma 5:2·6:2). 무엇을 보여줄지는 play-state.ts가 정하고 여기서는 그리기만 한다.
import { formatMediaTime } from '../shared/time';
import { applyCover } from './cover';
import { createToggle, el, isToggleOn, setToggle } from './dom';
import { createIcon } from './icons';
import { MESSAGES } from './messages';
import type { PlayViewModel } from './play-state';

export interface PlayView {
  render: (viewModel: PlayViewModel, isSkippingToday: boolean) => void;
  /** 지금 곡의 진행 (초). 소리가 날 때만 의미가 있다. */
  setProgress: (currentTime: number, duration: number) => void;
  setVolume: (volume: number) => void;
}

export interface PlayViewActions {
  onVolumeInput: (volume: number) => void;
}

export function setupPlayView(container: HTMLElement, actions: PlayViewActions): PlayView {
  const pillText = el('span', '');
  const pill = el('div', 'status-pill', el('span', 'dot'), pillText);
  const headline = el('h1', 'status-headline');
  const remain = el('p', 'status-remain');

  const cover = el('div', 'album-cover');
  const songLabel = el('p', 'song-label');
  const songTitle = el('p', 'song-title');
  const songArtist = el('p', 'song-artist');
  const progressFill = el('div', 'progress-fill');
  const timeCurrent = el('span', '', formatMediaTime(0));
  const timeTotal = el('span', '', formatMediaTime(0));

  const playButtonText = el('span', '');
  const playButton = el('button', 'btn-play');
  playButton.type = 'button';

  const volumeSlider = el('input', 'volume-slider');
  volumeSlider.type = 'range';
  volumeSlider.min = '0';
  volumeSlider.max = '100';
  volumeSlider.step = '1';
  volumeSlider.setAttribute('aria-label', MESSAGES.volume);
  const volumeValue = el('span', 'volume-value');

  const skipToggle = createToggle(MESSAGES.skipTodayTitle);

  container.replaceChildren(
    pill,
    el('div', 'status-row', headline, remain),
    el(
      'div',
      'player',
      cover,
      el(
        'div',
        'player-info',
        songLabel,
        songTitle,
        songArtist,
        el('div', 'progress-track', progressFill),
        el('div', 'progress-times', timeCurrent, timeTotal),
        el(
          'div',
          'controls',
          playButton,
          el('div', 'volume', createIcon('volume'), volumeSlider, volumeValue),
        ),
      ),
    ),
    el(
      'div',
      'skip-card',
      el(
        'div',
        '',
        el('p', 'skip-title', MESSAGES.skipTodayTitle),
        el('p', 'skip-desc', MESSAGES.skipTodayDesc),
      ),
      skipToggle,
    ),
  );

  // 버튼은 메인에 요청만 보낸다. 실제 재생·정지는 메인의 지시로 일어난다.
  let isSounding = false;
  playButton.addEventListener('click', () => {
    if (isSounding) window.api.requestStop();
    else window.api.requestPlay();
  });
  skipToggle.addEventListener('click', () => window.api.setSkipToday(!isToggleOn(skipToggle)));

  const showVolume = (percent: number): void => {
    volumeSlider.style.setProperty('--value', `${percent}%`);
    volumeValue.textContent = MESSAGES.volumeValue(percent);
  };
  // 끄는 동안(input)은 소리·숫자에만 반영하고, 손을 뗄 때(change) 저장한다 (FR-08).
  volumeSlider.addEventListener('input', () => {
    const percent = Number(volumeSlider.value);
    showVolume(percent);
    actions.onVolumeInput(percent / 100);
  });
  volumeSlider.addEventListener('change', () =>
    window.api.setVolume(Number(volumeSlider.value) / 100),
  );

  const showProgress = (currentTime: number, duration: number): void => {
    const ratio = duration > 0 && Number.isFinite(duration) ? currentTime / duration : 0;
    progressFill.style.width = `${Math.min(100, Math.max(0, ratio * 100))}%`;
    timeCurrent.textContent = formatMediaTime(currentTime);
    timeTotal.textContent = formatMediaTime(duration);
  };

  // 대기 중에는 다음 곡 길이를 보여주기 위해 곡 머리 정보만 읽는다 (재생하지 않음).
  const lengthProbe = new Audio();
  lengthProbe.preload = 'metadata';
  lengthProbe.muted = true;
  lengthProbe.addEventListener('loadedmetadata', () => {
    if (!isSounding) showProgress(0, lengthProbe.duration);
  });
  let probedUrl = '';

  return {
    render: (viewModel, isSkippingToday) => {
      isSounding = viewModel.isSounding;
      pillText.textContent = viewModel.pill;
      headline.textContent = viewModel.headline;
      headline.classList.toggle('is-compact', viewModel.isHeadlineCompact);
      remain.textContent = viewModel.remain;

      const track = viewModel.track;
      songLabel.textContent = viewModel.songLabel;
      songTitle.textContent = track?.title ?? MESSAGES.noTrackTitle;
      songArtist.textContent = track ? track.artist : MESSAGES.noTrackArtist;
      applyCover(cover, track?.coverUrl ?? null, track?.id ?? '');

      playButton.replaceChildren(
        createIcon(isSounding ? 'stop' : 'play'),
        Object.assign(playButtonText, {
          textContent: isSounding ? MESSAGES.stop : MESSAGES.playNow,
        }),
      );
      setToggle(skipToggle, isSkippingToday);

      if (!isSounding) {
        const url = track?.url ?? '';
        if (url !== probedUrl) {
          probedUrl = url;
          showProgress(0, 0);
          if (url) lengthProbe.src = url;
          else lengthProbe.removeAttribute('src');
        }
      } else {
        probedUrl = '';
      }
    },
    setProgress: (currentTime, duration) => {
      if (isSounding) showProgress(currentTime, duration);
    },
    setVolume: (volume) => {
      const percent = Math.round(volume * 100);
      volumeSlider.value = String(percent);
      showVolume(percent);
    },
  };
}
