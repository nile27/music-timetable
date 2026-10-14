// 앱이 쓰는 폴더 위치. 한곳에 모아 두어야 이전·설명서 작업 때 찾기 쉽다.
import path from 'node:path';
import { app } from 'electron';

/** 연구원님이 탐색기에서 찾기 쉽도록 "내 음악" 아래 한국어 이름으로 둔다. */
const MUSIC_FOLDER_NAME = '음악 시간표';

/**
 * 음악 폴더: 내 음악/음악 시간표.
 * Windows에서 "내 음악"이 OneDrive로 옮겨져 있으면 이 경로도 OneDrive 안이 된다 (7단계 실기 확인).
 */
export function getMusicDir(): string {
  return path.join(app.getPath('music'), MUSIC_FOLDER_NAME);
}

/**
 * 기본 커버 이미지 폴더. 배포판은 electron-builder extraResources로 resources/cover에 복사되고,
 * 개발 중에는 프로젝트의 resources/cover를 그대로 쓴다.
 */
export function getDefaultCoverDir(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'cover')
    : path.join(app.getAppPath(), 'resources', 'cover');
}
