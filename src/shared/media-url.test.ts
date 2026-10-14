import { describe, expect, it } from 'vitest';
import { fromMediaUrl, toMediaUrl } from './media-url';

describe('toMediaUrl / fromMediaUrl', () => {
  const paths = [
    'C:\\Users\\연구원\\Music\\음악 시간표\\아침 노래 01.mp3',
    '/Users/me/music/lofi piano.mp3',
    'D:\\음악\\100% 신나는 #1 (live)?.m4a',
    '\\\\server\\share\\곡.wav',
  ];

  it.each(paths)('경로를 그대로 되돌린다: %s', (filePath) => {
    const url = toMediaUrl(filePath);
    expect(url.startsWith('media://local/')).toBe(true);
    expect(fromMediaUrl(url)).toBe(filePath);
  });

  it('경로 구분자와 ..를 인코딩해 URL 정규화로 경로가 바뀌지 않게 한다', () => {
    const url = toMediaUrl('/a/../b.mp3');
    expect(url).not.toContain('/../');
    expect(fromMediaUrl(url)).toBe('/a/../b.mp3');
  });
});

describe('fromMediaUrl', () => {
  it.each([
    ['다른 스킴', 'file:///C:/a.mp3'],
    ['다른 호스트', 'media://other/%2Fa.mp3'],
    ['경로 없음', 'media://local/'],
    ['잘못된 인코딩', 'media://local/%E0%A4%A'],
    ['URL 아님', 'not a url'],
  ])('%s → null', (_name, url) => {
    expect(fromMediaUrl(url)).toBeNull();
  });
});
