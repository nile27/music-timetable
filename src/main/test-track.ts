// 1단계 임시 모듈: 프로젝트 music/ 폴더의 첫 mp3를 재생 대상으로 고른다.
// 2단계에서 음악 폴더 관리(library)로 대체한다.
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import type { Track } from '../shared/types';
import { toMediaUrl } from '../shared/media-url';

export async function findTestTrack(musicDir: string): Promise<Track | null> {
  let names: string[];
  try {
    names = await readdir(musicDir);
  } catch {
    console.warn(`[test-track] 음악 폴더를 읽지 못했습니다: ${musicDir}`);
    return null;
  }

  const fileName = names.filter((name) => path.extname(name).toLowerCase() === '.mp3').sort()[0];
  if (!fileName) {
    console.warn(`[test-track] mp3 파일이 없습니다: ${musicDir}`);
    return null;
  }

  return {
    title: path.basename(fileName, path.extname(fileName)),
    url: toMediaUrl(path.join(musicDir, fileName)),
  };
}
