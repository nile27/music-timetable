import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  isAudioFileName,
  isImageFileName,
  isSameTrackSet,
  mergeTrackOrder,
  pickDefaultCover,
  planDroppedFiles,
  repairNextTrackId,
  sortTrackNames,
  toTrackInfo,
} from './library-rules';

describe('isAudioFileName', () => {
  it.each(['a.mp3', 'B.MP3', '노래.wav', 'x.ogg', 'y.M4a', '01. 아침.mp3'])('%s → 음악', (name) => {
    expect(isAudioFileName(name)).toBe(true);
  });

  it.each([
    ['문서', '보고서.docx'],
    ['이미지', 'cover.jpg'],
    ['확장자 없음', 'mp3'],
    ['확장자만', '.mp3'],
    ['macOS 숨김 파일', '._노래.mp3'],
    ['임시 파일', '~$노래.mp3'],
    ['확장자 뒤에 더 붙음', '노래.mp3.txt'],
    ['지원 안 하는 형식', '노래.flac'],
  ])('%s(%s) → 음악 아님', (_name, fileName) => {
    expect(isAudioFileName(fileName)).toBe(false);
  });
});

describe('isImageFileName', () => {
  it.each(['a.jpg', 'b.JPEG', 'c.png', 'd.webp'])('%s → 이미지', (name) => {
    expect(isImageFileName(name)).toBe(true);
  });
  it.each(['CREDITS.md', 'a.gif', '.hidden.jpg', 'Thumbs.db'])('%s → 이미지 아님', (name) => {
    expect(isImageFileName(name)).toBe(false);
  });
});

describe('sortTrackNames', () => {
  it('숫자는 크기순으로 정렬한다', () => {
    expect(sortTrackNames(['10.mp3', '2.mp3', '1.mp3'])).toEqual(['1.mp3', '2.mp3', '10.mp3']);
  });

  it('한글은 가나다순으로 정렬한다', () => {
    expect(sortTrackNames(['하늘.mp3', '가을.mp3', '나무.mp3'])).toEqual([
      '가을.mp3',
      '나무.mp3',
      '하늘.mp3',
    ]);
  });

  it('번호를 붙인 이름은 번호순으로 온다', () => {
    expect(sortTrackNames(['03_하늘.mp3', '01_하늘.mp3', '2_가을.mp3', '10_나무.mp3'])).toEqual([
      '01_하늘.mp3',
      '2_가을.mp3',
      '03_하늘.mp3',
      '10_나무.mp3',
    ]);
  });

  it('대소문자만 다른 이름도 매번 같은 순서', () => {
    expect(sortTrackNames(['b.mp3', 'A.mp3', 'a.mp3'])).toEqual(['A.mp3', 'a.mp3', 'b.mp3']);
    expect(sortTrackNames(['a.mp3', 'b.mp3', 'A.mp3'])).toEqual(['A.mp3', 'a.mp3', 'b.mp3']);
  });

  it('원본 배열은 바꾸지 않는다', () => {
    const names = ['b.mp3', 'a.mp3'];
    sortTrackNames(names);
    expect(names).toEqual(['b.mp3', 'a.mp3']);
  });
});

describe('planDroppedFiles', () => {
  it('Windows 경로를 이름별로 분류한다', () => {
    const plan = planDroppedFiles(
      [
        'C:\\Users\\연구원\\Downloads\\새 노래.mp3',
        'C:\\Users\\연구원\\Downloads\\보고서.hwp',
        'D:\\USB\\있는 노래.MP3',
      ],
      ['있는 노래.mp3'],
      path.win32,
    );
    expect(plan).toEqual({
      toCopy: [
        { sourcePath: 'C:\\Users\\연구원\\Downloads\\새 노래.mp3', fileName: '새 노래.mp3' },
      ],
      duplicates: ['있는 노래.MP3'],
      notAudio: ['보고서.hwp'],
    });
  });

  it('같은 드롭 안에서 이름이 겹치면 첫 번째만 복사한다', () => {
    const plan = planDroppedFiles(['/a/곡.mp3', '/b/곡.mp3'], [], path.posix);
    expect(plan.toCopy.map((item) => item.sourcePath)).toEqual(['/a/곡.mp3']);
    expect(plan.duplicates).toEqual(['곡.mp3']);
  });

  it('빈 목록이면 아무것도 하지 않는다', () => {
    expect(planDroppedFiles([], ['a.mp3'], path.posix)).toEqual({
      toCopy: [],
      duplicates: [],
      notAudio: [],
    });
  });
});

describe('pickDefaultCover', () => {
  const covers = ['c.jpg', 'a.jpg', 'b.png'];

  it('이미지가 없으면 null', () => {
    expect(pickDefaultCover('곡.mp3', [])).toBeNull();
  });

  it('이미지가 1장이면 모든 곡이 그 이미지를 쓴다', () => {
    for (const name of ['a.mp3', '곡.mp3', '01_아침.mp3']) {
      expect(pickDefaultCover(name, ['only.jpg'])).toBe('only.jpg');
    }
  });

  it('같은 곡은 항상 같은 이미지 (목록 순서와 무관)', () => {
    const first = pickDefaultCover('아침 노래.mp3', covers);
    expect(pickDefaultCover('아침 노래.mp3', [...covers].reverse())).toBe(first);
    expect(covers).toContain(first);
  });

  it('곡이 여러 개면 이미지가 나눠 배정된다', () => {
    const names = Array.from({ length: 30 }, (_, i) => `노래 ${i}.mp3`);
    const used = new Set(names.map((name) => pickDefaultCover(name, covers)));
    expect(used.size).toBe(covers.length);
  });
});

describe('toTrackInfo', () => {
  it('태그가 있으면 태그를 쓴다', () => {
    expect(toTrackInfo('01.mp3', { title: ' 아침 ', artist: '가수' })).toEqual({
      title: '아침',
      artist: '가수',
    });
  });

  it('제목 태그가 없거나 비어 있으면 파일 이름(확장자 제외)', () => {
    expect(toTrackInfo('아침 노래.mp3', {})).toEqual({ title: '아침 노래', artist: '' });
    expect(toTrackInfo('a.b.mp3', { title: '  ' })).toEqual({ title: 'a.b', artist: '' });
  });
});

describe('mergeTrackOrder', () => {
  it('저장된 순서를 따른다', () => {
    expect(mergeTrackOrder(['c.mp3', 'a.mp3', 'b.mp3'], ['a.mp3', 'b.mp3', 'c.mp3'])).toEqual([
      'c.mp3',
      'a.mp3',
      'b.mp3',
    ]);
  });

  it('새 곡은 맨 위, 한 번에 들어온 새 곡들끼리는 이름순', () => {
    expect(mergeTrackOrder(['b.mp3', 'a.mp3'], ['a.mp3', 'b.mp3', '10.mp3', '2.mp3'])).toEqual([
      '2.mp3',
      '10.mp3',
      'b.mp3',
      'a.mp3',
    ]);
  });

  it('폴더에서 사라진 곡은 뺀다', () => {
    expect(mergeTrackOrder(['b.mp3', 'x.mp3', 'a.mp3'], ['a.mp3', 'b.mp3'])).toEqual([
      'b.mp3',
      'a.mp3',
    ]);
  });

  it('순서가 비어 있으면(처음 설치, 1.0.0에서 올라옴) 이름순 = 1.0.0의 순서', () => {
    const names = ['하늘.mp3', '10_나무.mp3', '2_가을.mp3'];
    expect(mergeTrackOrder([], names)).toEqual(sortTrackNames(names));
  });

  it('저장된 순서에 같은 이름이 두 번 있으면(손으로 고친 파일) 한 번만', () => {
    expect(mergeTrackOrder(['a.mp3', 'b.mp3', 'a.mp3'], ['a.mp3', 'b.mp3'])).toEqual([
      'a.mp3',
      'b.mp3',
    ]);
  });
});

describe('isSameTrackSet', () => {
  const IDS = ['a.mp3', 'b.mp3', 'c.mp3'];

  it('순서만 바뀐 같은 곡들 → true', () => {
    expect(isSameTrackSet(['c.mp3', 'a.mp3', 'b.mp3'], IDS)).toBe(true);
  });

  it.each([
    ['빠진 곡', ['a.mp3', 'b.mp3']],
    ['겹친 곡', ['a.mp3', 'a.mp3', 'b.mp3']],
    ['모르는 곡', ['a.mp3', 'b.mp3', '../x.mp3']],
  ])('%s → false', (_name, order) => {
    expect(isSameTrackSet(order, IDS)).toBe(false);
  });
});

describe('repairNextTrackId', () => {
  const BEFORE = ['a.mp3', 'b.mp3', 'c.mp3'];

  it('다음 곡이 남아 있으면 그대로 (새 곡이 맨 위에 들어와도 이어서 재생)', () => {
    expect(repairNextTrackId('b.mp3', BEFORE, ['new.mp3', ...BEFORE])).toBe('b.mp3');
  });

  it('다음 곡이 지워지면 그 아래 곡', () => {
    expect(repairNextTrackId('b.mp3', BEFORE, ['a.mp3', 'c.mp3'])).toBe('c.mp3');
  });

  it('아래 곡도 지워졌으면 더 아래, 끝이면 맨 위로 돌아가서 찾는다', () => {
    expect(repairNextTrackId('b.mp3', BEFORE, ['a.mp3'])).toBe('a.mp3');
    expect(repairNextTrackId('c.mp3', BEFORE, ['a.mp3', 'b.mp3'])).toBe('a.mp3');
  });

  it('곡이 하나도 안 남으면 null', () => {
    expect(repairNextTrackId('b.mp3', BEFORE, [])).toBeNull();
  });

  it('예전 목록에도 없던 이름이면 맨 위 곡', () => {
    expect(repairNextTrackId('x.mp3', BEFORE, BEFORE)).toBe('a.mp3');
  });

  it('null은 그대로 (맨 위 곡부터)', () => {
    expect(repairNextTrackId(null, BEFORE, BEFORE)).toBeNull();
  });
});
