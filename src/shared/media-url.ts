// 로컬 파일 경로 ↔ media:// 주소 변환.
// 개발 중 화면은 http://localhost에서 열리므로 file:// 를 직접 재생할 수 없다.
// 그래서 메인이 등록한 media:// 프로토콜로 우회하고, 실제 파일 접근 허용 여부는 메인이 판단한다.

export const MEDIA_SCHEME = 'media';
// standard 스킴은 호스트가 필요하다. 경로를 호스트에 넣으면 소문자화되므로 고정 호스트를 둔다.
const MEDIA_HOST = 'local';

export function toMediaUrl(filePath: string): string {
  // 경로 전체를 한 덩어리로 인코딩한다. '/'·'\\'·':'까지 인코딩되어야
  // Chromium이 경로를 정규화(.. 제거, \ → /)하면서 원래 경로를 바꾸지 않는다.
  return `${MEDIA_SCHEME}://${MEDIA_HOST}/${encodeURIComponent(filePath)}`;
}

/** media:// 주소에서 원래 파일 경로를 꺼낸다. 형식이 맞지 않으면 null. */
export function fromMediaUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== `${MEDIA_SCHEME}:` || parsed.host !== MEDIA_HOST) return null;

  const encoded = parsed.pathname.slice(1);
  if (!encoded) return null;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
}
