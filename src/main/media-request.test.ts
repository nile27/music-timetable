import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getAudioMimeType, parseRangeHeader, resolveAllowedPath } from './media-request';

describe('resolveAllowedPath (Windows)', () => {
  const roots = ['C:\\Users\\연구원\\Music\\음악 시간표'];
  const check = (p: string): string | null => resolveAllowedPath(p, roots, path.win32);

  it('허용 폴더 안의 파일은 정규화된 경로를 돌려준다', () => {
    expect(check('C:\\Users\\연구원\\Music\\음악 시간표\\아침.mp3')).toBe(
      'C:\\Users\\연구원\\Music\\음악 시간표\\아침.mp3',
    );
  });

  it('하위 폴더도 허용한다', () => {
    expect(check('C:\\Users\\연구원\\Music\\음악 시간표\\폴더\\곡.mp3')).not.toBeNull();
  });

  it('드라이브 문자·폴더 이름의 대소문자 차이는 같은 경로로 본다', () => {
    expect(check('c:\\users\\연구원\\music\\음악 시간표\\곡.mp3')).not.toBeNull();
  });

  it('슬래시(/)로 적어도 같은 경로로 본다', () => {
    expect(check('C:/Users/연구원/Music/음악 시간표/곡.mp3')).not.toBeNull();
  });

  it('이름이 ..으로 시작하는 파일은 바깥이 아니다', () => {
    expect(check('C:\\Users\\연구원\\Music\\음악 시간표\\..곡.mp3')).not.toBeNull();
  });

  it.each([
    ['..로 바깥 폴더', 'C:\\Users\\연구원\\Music\\음악 시간표\\..\\secret.txt'],
    ['상위 폴더', 'C:\\Users\\연구원\\Music\\other.mp3'],
    ['이름이 비슷한 형제 폴더', 'C:\\Users\\연구원\\Music\\음악 시간표2\\곡.mp3'],
    ['다른 드라이브', 'D:\\음악 시간표\\곡.mp3'],
    ['허용 폴더 자신', 'C:\\Users\\연구원\\Music\\음악 시간표'],
    ['상대 경로', '음악 시간표\\곡.mp3'],
    ['네트워크 경로', '\\\\server\\share\\곡.mp3'],
    ['널 문자', 'C:\\Users\\연구원\\Music\\음악 시간표\\a.mp3\0.txt'],
  ])('%s → 거부', (_name, p) => {
    expect(check(p)).toBeNull();
  });

  it('허용 폴더가 없으면 모두 거부한다', () => {
    expect(resolveAllowedPath('C:\\a\\b.mp3', [], path.win32)).toBeNull();
  });
});

describe('resolveAllowedPath (macOS)', () => {
  const roots = ['/Users/me/project/music'];
  const check = (p: string): string | null => resolveAllowedPath(p, roots, path.posix);

  it('폴더 안 파일 허용', () => {
    expect(check('/Users/me/project/music/lofi.mp3')).toBe('/Users/me/project/music/lofi.mp3');
  });

  it.each([
    '/Users/me/project/music/../package.json',
    '/etc/passwd',
    '/Users/me/project/music-other/a.mp3',
    '/Users/me/project/music',
  ])('%s → 거부', (p) => {
    expect(check(p)).toBeNull();
  });

  it('허용 폴더가 여러 개면 그중 하나에만 들어 있어도 허용한다', () => {
    expect(resolveAllowedPath('/b/x.mp3', ['/a', '/b'], path.posix)).toBe('/b/x.mp3');
  });
});

describe('parseRangeHeader', () => {
  const size = 1000;

  it.each([
    ['헤더 없음', null],
    ['bytes 형식 아님', 'items=0-10'],
    ['여러 구간', 'bytes=0-10,20-30'],
    ['시작·끝 모두 없음', 'bytes=-'],
  ])('%s → 전체', (_name, header) => {
    expect(parseRangeHeader(header, size)).toEqual({ kind: 'full' });
  });

  it.each([
    ['처음부터 끝까지', 'bytes=0-', 0, 999],
    ['중간부터', 'bytes=500-', 500, 999],
    ['구간 지정', 'bytes=100-199', 100, 199],
    ['끝이 파일보다 크면 파일 끝까지', 'bytes=900-5000', 900, 999],
    ['끝에서 N바이트', 'bytes=-100', 900, 999],
    ['끝에서 N바이트가 파일보다 크면 처음부터', 'bytes=-5000', 0, 999],
    ['1바이트', 'bytes=0-0', 0, 0],
  ])('%s', (_name, header, start, end) => {
    expect(parseRangeHeader(header, size)).toEqual({ kind: 'partial', start, end });
  });

  it.each([
    ['시작이 파일 크기 이상', 'bytes=1000-'],
    ['시작 > 끝', 'bytes=200-100'],
    ['끝에서 0바이트', 'bytes=-0'],
  ])('%s → 범위 불가', (_name, header) => {
    expect(parseRangeHeader(header, size)).toEqual({ kind: 'unsatisfiable' });
  });

  it('빈 파일에 구간을 요청하면 범위 불가', () => {
    expect(parseRangeHeader('bytes=0-', 0)).toEqual({ kind: 'unsatisfiable' });
  });
});

describe('getAudioMimeType', () => {
  it.each([
    ['.mp3', 'audio/mpeg'],
    ['.MP3', 'audio/mpeg'],
    ['.wav', 'audio/wav'],
    ['.ogg', 'audio/ogg'],
    ['.m4a', 'audio/mp4'],
  ])('%s → %s', (ext, mime) => {
    expect(getAudioMimeType(ext)).toBe(mime);
  });

  it.each(['.txt', '.exe', ''])('%s → null', (ext) => {
    expect(getAudioMimeType(ext)).toBeNull();
  });
});
