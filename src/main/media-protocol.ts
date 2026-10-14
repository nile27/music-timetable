// media:// 프로토콜: 허용된 폴더 안의 파일만 화면에 내려준다.
// - audio: 음악 폴더의 오디오 파일
// - cover: 음악 폴더 곡 파일에 내장된 커버 이미지
// - default-cover: 앱 내장 기본 커버 폴더의 이미지
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { protocol } from 'electron';
import { MEDIA_SCHEME, parseMediaUrl, type MediaKind } from '../shared/media-url';
import {
  getAudioMimeType,
  getImageMimeType,
  parseRangeHeader,
  resolveAllowedPath,
} from './media-request';
import { readEmbeddedCover } from './track-tags';

let allowedRoots: Record<MediaKind, string[]> = { audio: [], cover: [], 'default-cover': [] };

/** app ready 전에 호출해야 한다 (Electron 제약). */
export function registerMediaScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: MEDIA_SCHEME,
      // stream: <audio>가 파일을 한 번에 다 받지 않고 흘려받으며 재생·탐색하려면 필요하다.
      privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true },
    },
  ]);
}

async function toRealPaths(roots: readonly string[]): Promise<string[]> {
  const resolved = await Promise.all(roots.map((root) => realpath(root).catch(() => null)));
  return resolved.filter((root): root is string => root !== null);
}

/**
 * 허용 폴더를 정한다. 바로가기(심볼릭 링크)로 바깥 파일을 가리키는 것을 막기 위해
 * 실제 경로로 바꿔 저장하고, 요청 파일도 실제 경로로 바꿔 비교한다.
 */
export async function setMediaRoots(roots: {
  music: readonly string[];
  defaultCovers: readonly string[];
}): Promise<void> {
  const music = await toRealPaths(roots.music);
  allowedRoots = {
    audio: music,
    cover: music,
    'default-cover': await toRealPaths(roots.defaultCovers),
  };
}

/** 요청 경로를 실제 경로로 바꾸고 허용 폴더 안의 파일인지 확인한다. 실패하면 오류 응답. */
async function resolveRequestedFile(
  kind: MediaKind,
  requested: string,
): Promise<{ filePath: string; size: number } | Response> {
  let filePath: string;
  try {
    filePath = await realpath(requested);
  } catch {
    return new Response(null, { status: 404 });
  }

  const allowed = resolveAllowedPath(filePath, allowedRoots[kind], path);
  if (!allowed) {
    console.warn(`[media] 허용 폴더 밖 요청 거부 (${kind}): ${requested}`);
    return new Response(null, { status: 403 });
  }

  try {
    const info = await stat(allowed);
    if (!info.isFile()) return new Response(null, { status: 404 });
    return { filePath: allowed, size: info.size };
  } catch {
    return new Response(null, { status: 404 });
  }
}

/** 파일을 그대로 내려준다. Range 요청이면 206으로 일부만 (오디오 탐색용). */
function respondWithFile(
  filePath: string,
  size: number,
  mimeType: string,
  rangeHeader: string | null,
): Response {
  const range = parseRangeHeader(rangeHeader, size);
  if (range.kind === 'unsatisfiable') {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  }

  const start = range.kind === 'partial' ? range.start : 0;
  const end = range.kind === 'partial' ? range.end : size - 1;
  const headers: Record<string, string> = {
    'Content-Type': mimeType,
    'Content-Length': String(size === 0 ? 0 : end - start + 1),
    'Accept-Ranges': 'bytes',
  };
  if (range.kind === 'partial') headers['Content-Range'] = `bytes ${start}-${end}/${size}`;

  const body =
    size === 0
      ? null
      : (Readable.toWeb(createReadStream(filePath, { start, end })) as ReadableStream<Uint8Array>);
  return new Response(body, { status: range.kind === 'partial' ? 206 : 200, headers });
}

export function handleMediaProtocol(): void {
  protocol.handle(MEDIA_SCHEME, async (request) => {
    const parsed = parseMediaUrl(request.url);
    if (!parsed) return new Response(null, { status: 400 });

    const resolved = await resolveRequestedFile(parsed.kind, parsed.filePath);
    if (resolved instanceof Response) return resolved;
    const { filePath, size } = resolved;
    const extension = path.extname(filePath);

    if (parsed.kind === 'cover') {
      if (!getAudioMimeType(extension)) return new Response(null, { status: 415 });
      try {
        const cover = await readEmbeddedCover(filePath);
        if (!cover) return new Response(null, { status: 404 });
        return new Response(cover.data, { headers: { 'Content-Type': cover.mimeType } });
      } catch (error) {
        console.warn(`[media] 내장 커버를 읽지 못했습니다: ${filePath}`, error);
        return new Response(null, { status: 404 });
      }
    }

    const mimeType =
      parsed.kind === 'audio' ? getAudioMimeType(extension) : getImageMimeType(extension);
    if (!mimeType) return new Response(null, { status: 415 });
    return respondWithFile(filePath, size, mimeType, request.headers.get('range'));
  });
}
