// media:// 프로토콜: 허용된 음악 폴더 안의 오디오 파일만 화면에 내려준다.
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { protocol } from 'electron';
import { fromMediaUrl, MEDIA_SCHEME } from '../shared/media-url';
import { getAudioMimeType, parseRangeHeader, resolveAllowedPath } from './media-request';

let allowedRoots: string[] = [];

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

/**
 * 재생을 허용할 폴더를 바꾼다. 바로가기(심볼릭 링크)로 바깥 파일을 가리키는 것을 막기 위해
 * 실제 경로로 바꿔 저장하고, 요청 파일도 실제 경로로 바꿔 비교한다.
 */
export async function setAllowedMediaRoots(roots: readonly string[]): Promise<void> {
  const resolved = await Promise.all(roots.map((root) => realpath(root).catch(() => null)));
  allowedRoots = resolved.filter((root): root is string => root !== null);
}

export function handleMediaProtocol(): void {
  protocol.handle(MEDIA_SCHEME, async (request) => {
    const requested = fromMediaUrl(request.url);
    if (!requested) return new Response(null, { status: 400 });

    let filePath: string;
    try {
      filePath = await realpath(requested);
    } catch {
      return new Response(null, { status: 404 });
    }

    const allowed = resolveAllowedPath(filePath, allowedRoots, path);
    if (!allowed) {
      console.warn(`[media] 허용 폴더 밖 요청 거부: ${requested}`);
      return new Response(null, { status: 403 });
    }

    const mimeType = getAudioMimeType(path.extname(allowed));
    if (!mimeType) return new Response(null, { status: 415 });

    let size: number;
    try {
      const info = await stat(allowed);
      if (!info.isFile()) return new Response(null, { status: 404 });
      size = info.size;
    } catch {
      return new Response(null, { status: 404 });
    }

    const range = parseRangeHeader(request.headers.get('range'), size);
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
        : (Readable.toWeb(createReadStream(allowed, { start, end })) as ReadableStream<Uint8Array>);
    return new Response(body, { status: range.kind === 'partial' ? 206 : 200, headers });
  });
}
