// 전체 틀: 왼쪽 탭 메뉴, "지금 상태" 카드, 흐린 커버 배경.
import { el } from './dom';
import { createIcon, type IconName } from './icons';
import { MESSAGES } from './messages';
import type { PlayTone } from './play-state';

export type TabName = 'play' | 'schedule' | 'songs' | 'settings';

const TABS: readonly { name: TabName; icon: IconName; label: string }[] = [
  { name: 'play', icon: 'tabPlay', label: MESSAGES.tabPlay },
  { name: 'schedule', icon: 'tabSchedule', label: MESSAGES.tabSchedule },
  { name: 'songs', icon: 'tabSongs', label: MESSAGES.tabSongs },
  { name: 'settings', icon: 'tabSettings', label: MESSAGES.tabSettings },
];

export interface Shell {
  setTone: (tone: PlayTone) => void;
  setMiniStatus: (state: string, text: string) => void;
  /** 배경 커버를 바꾼다. 같은 커버면 아무것도 안 하고, 다르면 서서히 바뀐다. */
  setBackground: (background: string) => void;
}

export function setupShell(app: HTMLElement, nav: HTMLElement): Shell {
  const tabButtons = TABS.map(({ name, icon, label }) => {
    const button = el('button', 'nav-tab', createIcon(icon), el('span', '', label));
    button.type = 'button';
    button.dataset.tab = name;
    button.addEventListener('click', () => selectTab(name));
    return button;
  });

  const miniState = el('span', '');
  const miniText = el('p', 'mini-status-text');
  nav.replaceChildren(
    el('div', 'nav-brand', createIcon('appLogo'), el('span', 'nav-brand-text', MESSAGES.appTitle)),
    el('div', 'nav-tabs', ...tabButtons),
    el(
      'div',
      'mini-status',
      el('p', 'mini-status-label', MESSAGES.miniStatusLabel),
      el('p', 'mini-status-state', el('span', 'dot'), miniState),
      miniText,
    ),
  );

  function selectTab(name: TabName): void {
    app.dataset.tab = name;
    for (const button of tabButtons) {
      const isActive = button.dataset.tab === name;
      button.classList.toggle('is-active', isActive);
      if (isActive) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
    for (const view of app.querySelectorAll<HTMLElement>('.view')) {
      view.classList.toggle('is-active', view.dataset.view === name);
    }
  }
  selectTab('play');

  // 배경 두 장을 번갈아 써서 곡이 바뀔 때 서서히 바뀌게 한다 (화면설계서: opacity 전환).
  const layers = [
    app.querySelector<HTMLElement>('#bg-cover-a'),
    app.querySelector<HTMLElement>('#bg-cover-b'),
  ].filter((layer): layer is HTMLElement => layer !== null);
  let activeLayer = 0;
  let currentBackground = '';

  return {
    setTone: (tone) => {
      app.dataset.tone = tone;
    },
    setMiniStatus: (state, text) => {
      miniState.textContent = state;
      miniText.textContent = text;
    },
    setBackground: (background) => {
      if (background === currentBackground || layers.length < 2) return;
      currentBackground = background;
      activeLayer = 1 - activeLayer;
      layers[activeLayer].style.background = background;
      layers[activeLayer].classList.remove('is-hidden');
      layers[1 - activeLayer].classList.add('is-hidden');
    },
  };
}
