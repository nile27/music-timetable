// 디자인 전달 파일(local전용/figma/icons)의 아이콘을 그대로 쓴다. 모양을 바꾸지 말 것.
// ?raw로 SVG 글자를 받아 넣는 이유: 아이콘이 currentColor라 글자색을 따라가게 하려면 인라인이어야 한다.
import alert from './assets/icons/alert.svg?raw';
import appLogo from './assets/icons/app-logo.svg?raw';
import chevronLeft from './assets/icons/chevron-left.svg?raw';
import chevronRight from './assets/icons/chevron-right.svg?raw';
import folder from './assets/icons/folder.svg?raw';
import play from './assets/icons/play.svg?raw';
import plus from './assets/icons/plus.svg?raw';
import stop from './assets/icons/stop.svg?raw';
import tabPlay from './assets/icons/tab-play.svg?raw';
import tabSchedule from './assets/icons/tab-schedule.svg?raw';
import tabSettings from './assets/icons/tab-settings.svg?raw';
import tabSongs from './assets/icons/tab-songs.svg?raw';
import trash from './assets/icons/trash.svg?raw';
import upload from './assets/icons/upload.svg?raw';
import volume from './assets/icons/volume.svg?raw';

const ICONS = {
  alert,
  appLogo,
  chevronLeft,
  chevronRight,
  folder,
  play,
  plus,
  stop,
  tabPlay,
  tabSchedule,
  tabSettings,
  tabSongs,
  trash,
  upload,
  volume,
} as const;

export type IconName = keyof typeof ICONS;

/** 앱에 함께 묶인 고정 SVG라 innerHTML로 넣어도 안전하다 (사용자 입력이 섞이지 않음). */
export function createIcon(name: IconName, className = ''): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = `icon ${className}`.trim();
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = ICONS[name];
  return span;
}
