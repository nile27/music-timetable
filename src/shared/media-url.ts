// 로컬 파일 경로 ↔ media:// 주소 변환.
// 개발 중 화면은 http://localhost에서 열리므로 file:// 를 직접 열 수 없다.
// 그래서 메인이 등록한 media:// 프로토콜로 우회하고, 실제 파일 접근 허용 여부는 메인이 판단한다.

export const MEDIA_SCHEME = 'media';

/**
 * 주소 종류. standard 스킴은 호스트가 필요한데, 경로를 호스트에 넣으면 소문자화되므로
 * 호스트 자리에는 종류를 둔다.
 * - audio: 음악 폴더의 곡 파일
 * - cover: 음악 폴더 곡 파일에 내장된 커버 이미지
 * - default-cover: 앱 내장 기본 커버 이미지 파일
 */
export type MediaKind = 'audio' | 'cover' | 'default-cover';

const MEDIA_KINDS: readonly MediaKind[] = ['audio', 'cover', 'default-cover'];

export function toMediaUrl(kind: MediaKind, filePath: string): string {
  // 경로 전체를 한 덩어리로 인코딩한다. '/'·'\\'·':'까지 인코딩되어야
  // Chromium이 경로를 정규화(.. 제거, \ → /)하면서 원래 경로를 바꾸지 않는다.
  return `${MEDIA_SCHEME}://${kind}/${encodeURIComponent(filePath)}`;
}

/** media:// 주소에서 종류와 원래 파일 경로를 꺼낸다. 형식이 맞지 않으면 null. */
export function parseMediaUrl(url: string): { kind: MediaKind; filePath: string } | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== `${MEDIA_SCHEME}:`) return null;
  const kind = MEDIA_KINDS.find((candidate) => candidate === parsed.host);
  if (!kind) return null;

  const encoded = parsed.pathname.slice(1);
  if (!encoded) return null;
  try {
    return { kind, filePath: decodeURIComponent(encoded) };
  } catch {
    return null;
  }
}
