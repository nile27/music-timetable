// 커버 표시. 커버 주소가 있으면 그 이미지를, 없거나 못 읽으면 그라데이션을 보여준다.

/** FNV-1a. 같은 곡은 항상 같은 색이 나오도록 (main의 기본 커버 배정과 같은 방식). */
function hashString(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * 커버 이미지가 하나도 없을 때 곡마다 다른 그라데이션 (디자인 전달 파일 songs.css의 규칙).
 * 커버 이미지가 있어도 그 아래에 깔아서, 이미지를 못 읽으면 이 색이 보이게 한다.
 */
export function getFallbackCover(seed: string): string {
  const hue = (hashString(seed) * 47) % 360;
  return [
    `radial-gradient(circle at 30% 30%, hsl(${hue} 85% 65%) 0%, hsl(${hue} 85% 65% / 0) 60%)`,
    `radial-gradient(circle at 75% 75%, hsl(${hue + 60} 80% 55%) 0%, hsl(${hue + 60} 80% 55% / 0) 65%)`,
    `hsl(${hue + 200} 40% 18%)`,
  ].join(', ');
}

/**
 * 커버 배경 값 (CSS background). media:// 주소는 encodeURIComponent로 만들어져 큰따옴표가 들어 있지
 * 않으므로 url("...") 안에 그대로 넣어도 안전하다. 이미지를 못 읽으면 아래 그라데이션이 보인다.
 */
export function getCoverBackground(coverUrl: string | null, seed: string): string {
  const fallback = getFallbackCover(seed);
  return coverUrl ? `url("${coverUrl}") center / cover no-repeat, ${fallback}` : fallback;
}

export function applyCover(element: HTMLElement, coverUrl: string | null, seed: string): void {
  element.style.background = getCoverBackground(coverUrl, seed);
}
