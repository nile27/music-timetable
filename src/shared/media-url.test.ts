import { describe, expect, it } from 'vitest';
import { parseMediaUrl, toMediaUrl, type MediaKind } from './media-url';

describe('toMediaUrl / parseMediaUrl', () => {
  const paths = [
    'C:\\Users\\연구원\\Music\\음악 시간표\\아침 노래 01.mp3',
    '/Users/me/music/lofi piano.mp3',
    'D:\\음악\\100% 신나는 #1 (live)?.m4a',
    '\\\\server\\share\\곡.wav',
  ];
  const kinds: MediaKind[] = ['audio', 'cover', 'default-cover'];

  it.each(paths)('경로를 그대로 되돌린다: %s', (filePath) => {
    for (const kind of kinds) {
      const url = toMediaUrl(kind, filePath);
      expect(url.startsWith(`media://${kind}/`)).toBe(true);
      expect(parseMediaUrl(url)).toEqual({ kind, filePath });
    }
  });

  it('경로 구분자와 ..를 인코딩해 URL 정규화로 경로가 바뀌지 않게 한다', () => {
    const url = toMediaUrl('audio', '/a/../b.mp3');
    expect(url).not.toContain('/../');
    expect(parseMediaUrl(url)?.filePath).toBe('/a/../b.mp3');
  });
});

describe('parseMediaUrl', () => {
  it.each([
    ['다른 스킴', 'file:///C:/a.mp3'],
    ['모르는 종류', 'media://other/%2Fa.mp3'],
    ['경로 없음', 'media://audio/'],
    ['잘못된 인코딩', 'media://audio/%E0%A4%A'],
    ['URL 아님', 'not a url'],
  ])('%s → null', (_name, url) => {
    expect(parseMediaUrl(url)).toBeNull();
  });
});
