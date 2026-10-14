// IPC 채널 이름은 여기서만 정의한다. main·preload·renderer가 문자열을 직접 쓰면
// 한쪽만 바뀌었을 때 조용히 끊기므로 반드시 이 상수를 거친다.
export const IPC = {
  /** 화면 → 메인: 재생 버튼을 눌렀다. 무엇을 틀지는 메인이 정한다. */
  PLAYER_REQUEST_PLAY: 'player:requestPlay',
  /** 화면 → 메인: 정지 버튼을 눌렀다. */
  PLAYER_REQUEST_STOP: 'player:requestStop',
  /** 메인 → 화면: 이 곡을 재생하라 (Track). */
  PLAYER_PLAY: 'player:play',
  /** 메인 → 화면: 즉시 정지하라. */
  PLAYER_STOP: 'player:stop',

  /** 화면 → 메인 (invoke): 곡 목록 요청 → LibraryTrack[] */
  LIBRARY_LIST: 'library:list',
  /** 메인 → 화면: 음악 폴더가 바뀌었다 (LibraryTrack[]). */
  LIBRARY_CHANGED: 'library:changed',
  /** 화면 → 메인 (invoke): 드롭한 파일 경로 목록 → AddFilesResult */
  LIBRARY_ADD: 'library:add',
  /** 화면 → 메인: 음악 폴더를 탐색기로 연다. */
  LIBRARY_OPEN_FOLDER: 'library:openFolder',
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];
