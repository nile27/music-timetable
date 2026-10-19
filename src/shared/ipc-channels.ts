// IPC 채널 이름은 여기서만 정의한다. main·preload·renderer가 문자열을 직접 쓰면
// 한쪽만 바뀌었을 때 조용히 끊기므로 반드시 이 상수를 거친다.
export const IPC = {
  /** 화면 → 메인: 재생 버튼을 눌렀다. 무엇을 틀지는 메인이 정한다. */
  PLAYER_REQUEST_PLAY: 'player:requestPlay',
  /** 화면 → 메인: 정지 버튼을 눌렀다. */
  PLAYER_REQUEST_STOP: 'player:requestStop',
  /** 화면 → 메인: 노래 목록에서 곡을 두 번 눌렀다 (트랙 id). 그 곡부터 재생한다. */
  PLAYER_REQUEST_PLAY_TRACK: 'player:requestPlayTrack',
  /** 화면 → 메인: [다음 곡] 버튼을 눌렀다. 재생 중일 때만 다음 곡으로 넘긴다. */
  PLAYER_REQUEST_NEXT: 'player:requestNext',
  /** 화면 → 메인: [이전 곡] 버튼을 눌렀다. 재생 중일 때만 바로 위 곡으로 돌아간다. */
  PLAYER_REQUEST_PREVIOUS: 'player:requestPrevious',
  /** 메인 → 화면: 이 곡을 재생하라 (Track). */
  PLAYER_PLAY: 'player:play',
  /** 메인 → 화면: 즉시 정지하라. */
  PLAYER_STOP: 'player:stop',
  /** 화면 → 메인: 곡이 끝났다 (트랙 id). 메인이 다음 곡을 지시한다. */
  PLAYER_ENDED: 'player:ended',
  /** 화면 → 메인: 재생 실패 (트랙 id). 메인이 다음 곡으로 넘긴다. */
  PLAYER_ERROR: 'player:error',

  /** 메인 → 화면: 재생 상태·다음 재생 일정 (PlayerStatus). */
  STATUS_UPDATE: 'status:update',
  /** 화면 → 메인 (invoke): 현재 상태 요청 (화면을 처음 열 때). */
  STATUS_GET: 'status:get',

  /** 화면 → 메인 (invoke): 설정 요청 → AppSettings */
  SETTINGS_GET: 'settings:get',
  /** 화면 → 메인 (invoke): 시간표 저장 → SaveScheduleResult */
  SETTINGS_SAVE: 'settings:save',
  /** 화면 → 메인: 볼륨 변경 (0~1). 바꾸는 즉시 저장한다. */
  SETTINGS_SET_VOLUME: 'settings:setVolume',
  /** 화면 → 메인: PC 켜질 때 자동 실행 켜기/끄기 (boolean). */
  SETTINGS_SET_AUTO_LAUNCH: 'settings:setAutoLaunch',

  /** 화면 → 메인 (invoke): 앱 버전·공휴일 수록 연도 → AppInfo */
  APP_INFO: 'app:info',

  /** 화면 → 메인: "오늘은 재생 안 함" 켜기/끄기 (boolean). */
  DAY_SKIP_TODAY: 'day:skipToday',
  /** 화면 → 메인 (invoke): 쉬는 날 지정/해제 ("YYYY-MM-DD") → 바뀐 offDays */
  DAY_TOGGLE_OFF_DAY: 'day:toggleOffDay',
  /** 화면 → 메인 (invoke): 내장 공휴일 목록 (달력 표시용) → HolidayData */
  DAY_HOLIDAYS: 'day:holidays',

  /** 화면 → 메인 (invoke): 곡 목록 요청 → LibraryTrack[] */
  LIBRARY_LIST: 'library:list',
  /** 메인 → 화면: 음악 폴더가 바뀌었다 (LibraryTrack[]). */
  LIBRARY_CHANGED: 'library:changed',
  /** 화면 → 메인 (invoke): 드롭한 파일 경로 목록 → AddFilesResult */
  LIBRARY_ADD: 'library:add',
  /** 화면 → 메인: 음악 폴더를 탐색기로 연다. */
  LIBRARY_OPEN_FOLDER: 'library:openFolder',
  /** 화면 → 메인 (invoke): 곡을 휴지통으로 옮긴다 (트랙 id) → boolean(성공 여부) */
  LIBRARY_REMOVE: 'library:remove',
  /** 화면 → 메인 (invoke): 재생 순서를 바꾼다 (트랙 id 전체 목록) → boolean(받아들였는지) */
  LIBRARY_REORDER: 'library:reorder',
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];
