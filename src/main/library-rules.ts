// 음악 폴더 관리의 판정 규칙. 파일 시스템을 건드리지 않는 순수 함수로 두어 테스트한다.
import type { PlatformPath } from 'node:path';

const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.m4a'] as const;
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'] as const;

function getExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot <= 0 ? '' : fileName.slice(dot).toLowerCase();
}

/**
 * 숨김 파일(.DS_Store, macOS의 ._곡.mp3)과 Office·탐색기 임시 파일(~$)은
 * 확장자가 맞아도 실제 곡이 아니므로 제외한다.
 */
function isHiddenOrTemp(fileName: string): boolean {
  return fileName.startsWith('.') || fileName.startsWith('~$');
}

export function isAudioFileName(fileName: string): boolean {
  if (isHiddenOrTemp(fileName)) return false;
  return (AUDIO_EXTENSIONS as readonly string[]).includes(getExtension(fileName));
}

export function isImageFileName(fileName: string): boolean {
  if (isHiddenOrTemp(fileName)) return false;
  return (IMAGE_EXTENSIONS as readonly string[]).includes(getExtension(fileName));
}

// 재생 순서 = 파일 이름 자연 정렬. 한글은 가나다순, 숫자는 크기순(2 < 10).
// 연구원님이 파일 이름 앞에 번호를 붙여 순서를 바꿀 수 있고, PC를 옮겨도 순서가 유지된다.
const trackNameCollator = new Intl.Collator('ko', { numeric: true, sensitivity: 'base' });

export function sortTrackNames(names: readonly string[]): string[] {
  // 대소문자만 다른 이름도 순서가 매번 같도록 마지막에 일반 문자열 비교로 정한다.
  return [...names].sort((a, b) => trackNameCollator.compare(a, b) || (a < b ? -1 : a > b ? 1 : 0));
}

export interface DroppedFilePlan {
  /** 복사할 파일: 원본 경로와 음악 폴더 안에서 쓸 이름. */
  toCopy: { sourcePath: string; fileName: string }[];
  duplicates: string[];
  notAudio: string[];
}

/**
 * 드롭된 파일을 복사할 것 / 이미 있는 것 / 음악 아닌 것으로 나눈다.
 * Windows·macOS 기본 파일 시스템은 대소문자를 구분하지 않으므로 이름 비교도 구분하지 않는다.
 * 같은 드롭 안에서 이름이 겹치는 파일도 두 번째부터는 중복으로 본다.
 */
export function planDroppedFiles(
  sourcePaths: readonly string[],
  existingNames: readonly string[],
  pathApi: Pick<PlatformPath, 'basename'>,
): DroppedFilePlan {
  const taken = new Set(existingNames.map((name) => name.toLowerCase()));
  const plan: DroppedFilePlan = { toCopy: [], duplicates: [], notAudio: [] };

  for (const sourcePath of sourcePaths) {
    const fileName = pathApi.basename(sourcePath);
    if (!isAudioFileName(fileName)) {
      plan.notAudio.push(fileName);
      continue;
    }
    const key = fileName.toLowerCase();
    if (taken.has(key)) {
      plan.duplicates.push(fileName);
      continue;
    }
    taken.add(key);
    plan.toCopy.push({ sourcePath, fileName });
  }
  return plan;
}

/** FNV-1a 32비트. 실행할 때마다 같은 값이 나와야 하므로 직접 구현한다. */
function hashString(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * 내장 커버가 없는 곡에 기본 커버 이미지를 하나 배정한다 (FR-24: 같은 곡은 항상 같은 이미지).
 * 커버 목록을 이름순으로 정렬한 뒤 고르므로, 폴더를 읽는 순서가 달라도 결과가 같다.
 * 이미지가 없으면 null (화면이 단색 배경을 보여준다).
 */
export function pickDefaultCover(
  trackFileName: string,
  coverFileNames: readonly string[],
): string | null {
  if (coverFileNames.length === 0) return null;
  const sorted = [...coverFileNames].sort();
  return sorted[hashString(trackFileName) % sorted.length];
}

/** 태그가 비어 있으면 파일 이름(확장자 제외)을 제목으로 쓴다. */
export function toTrackInfo(
  fileName: string,
  tags: { title?: string; artist?: string },
): { title: string; artist: string } {
  const dot = fileName.lastIndexOf('.');
  const baseName = dot > 0 ? fileName.slice(0, dot) : fileName;
  return {
    title: tags.title?.trim() || baseName,
    artist: tags.artist?.trim() ?? '',
  };
}
