// media:// 요청 처리에 쓰는 판정 함수들. 파일·Electron을 건드리지 않는 순수 함수로 두어
// Windows 경로 규칙까지 맥에서 테스트할 수 있게 한다.
import type { PlatformPath } from 'node:path';

type PathApi = Pick<PlatformPath, 'isAbsolute' | 'resolve' | 'relative' | 'sep'>;

/**
 * 요청된 경로가 허용된 폴더 중 하나의 "안쪽" 파일이면 정규화된 경로를, 아니면 null을 돌려준다.
 * 화면이 media:// 주소를 마음대로 만들어 PC의 다른 파일을 읽지 못하게 하기 위함.
 * pathApi를 인자로 받는 이유: 테스트에서 path.win32를 넣어 Windows 경로를 검증하려고.
 */
export function resolveAllowedPath(
  requested: string,
  allowedRoots: readonly string[],
  pathApi: PathApi,
): string | null {
  // 널 문자는 OS마다 경로 해석이 달라 우회에 쓰일 수 있다.
  if (requested.includes('\0') || !pathApi.isAbsolute(requested)) return null;

  const target = pathApi.resolve(requested);
  for (const root of allowedRoots) {
    if (!root || !pathApi.isAbsolute(root)) continue;
    const rel = pathApi.relative(pathApi.resolve(root), target);
    // rel이 ''이면 폴더 자신, '..'로 시작하면 바깥, 절대경로면 다른 드라이브다.
    const isOutside =
      rel === '' || rel === '..' || rel.startsWith(`..${pathApi.sep}`) || pathApi.isAbsolute(rel);
    if (!isOutside) return target;
  }
  return null;
}

export type ByteRange =
  { kind: 'full' } | { kind: 'partial'; start: number; end: number } | { kind: 'unsatisfiable' };

/**
 * HTTP Range 헤더 해석. 오디오 탐색(재생 위치 이동)은 브라우저가 Range 요청으로 하므로
 * 206 응답을 돌려줘야 한다. 여러 구간 요청은 오디오 재생에 쓰이지 않아 전체 응답으로 처리한다.
 */
export function parseRangeHeader(header: string | null, size: number): ByteRange {
  if (!header) return { kind: 'full' };
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return { kind: 'full' };

  const [, startText, endText] = match;
  if (startText === '' && endText === '') return { kind: 'full' };
  if (size <= 0) return { kind: 'unsatisfiable' };

  if (startText === '') {
    // bytes=-N : 끝에서 N바이트
    const suffix = Number(endText);
    if (suffix === 0) return { kind: 'unsatisfiable' };
    return { kind: 'partial', start: Math.max(0, size - suffix), end: size - 1 };
  }

  const start = Number(startText);
  const end = endText === '' ? size - 1 : Math.min(Number(endText), size - 1);
  if (start >= size || start > end) return { kind: 'unsatisfiable' };
  return { kind: 'partial', start, end };
}

const AUDIO_MIME_TYPES: Readonly<Record<string, string>> = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
};

/** 확장자(점 포함)로 오디오 MIME 타입을 정한다. 지원하지 않는 형식이면 null. */
export function getAudioMimeType(extension: string): string | null {
  return AUDIO_MIME_TYPES[extension.toLowerCase()] ?? null;
}
