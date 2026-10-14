import type { ScheduleIssue } from './schedule';

/** 메인이 화면에 재생을 지시할 때 넘기는 곡 정보. */
export interface Track {
  /** 음악 폴더 안의 파일 이름. 곡 끝·오류 알림이 어떤 곡의 것인지 구분하는 데 쓴다. */
  id: string;
  /** 화면에 보여줄 제목 (태그가 없으면 파일 이름). */
  title: string;
  /** media:// 주소. 화면은 로컬 경로를 직접 열 수 없어서 메인이 변환해 준다. */
  url: string;
}

/** 음악 폴더의 곡 하나 (노래 목록에 표시). */
export interface LibraryTrack {
  /** 음악 폴더 안의 파일 이름. 폴더 안에서 겹치지 않으므로 식별자로 쓴다. */
  id: string;
  title: string;
  /** 태그에 가수가 없으면 빈 문자열. */
  artist: string;
  /** 재생용 media:// 주소. */
  url: string;
  /** 내장 커버 → 기본 커버 이미지 순서로 정한 주소. 둘 다 없으면 null(화면이 단색 배경). */
  coverUrl: string | null;
}

/** 드롭한 파일을 음악 폴더에 추가한 결과. 목록은 파일 이름. */
export interface AddFilesResult {
  added: string[];
  /** 같은 이름의 파일이 이미 있어서 건너뜀. */
  duplicates: string[];
  /** 음악 파일이 아니라서 제외함. */
  notAudio: string[];
  /** 복사 중 오류. */
  failed: string[];
}

/** 시간표의 구간 하나. 시각은 "HH:mm". 시작 포함·종료 미포함. */
export interface ScheduleSlot {
  name: string;
  start: string;
  end: string;
}

/** settings.json 구조 (아키텍처 5장). 구조가 바뀌면 version을 올리고 변환 코드를 추가한다. */
export interface AppSettings {
  version: 1;
  schedule: ScheduleSlot[];
  /** 사용자가 지정한 쉬는 날 "YYYY-MM-DD" (4단계). */
  offDays: string[];
  /** "오늘은 재생 안 함"을 켠 날짜 (4단계). */
  skipDate: string | null;
  /** 다음에 재생할 곡 번호. 곡이 시작될 때마다 그 다음 번호로 저장한다. */
  nextIndex: number;
  /** 0~1 */
  volume: number;
  /** PC 켜질 때 자동 실행 (5단계). */
  autoLaunch: boolean;
}

/**
 * 재생 상태.
 * - idle: 재생 안 함
 * - playing: 시간표 구간 안에서 재생 중
 * - manual: 구간 밖에서 [재생] 버튼으로 재생 중
 */
export type PlayMode = 'idle' | 'playing' | 'manual';

/** 메인 → 화면 상태 알림 (status:update). */
export interface PlayerStatus {
  mode: PlayMode;
  /** 지금 시각이 속한 구간 (재생하지 않아도 표시용으로 채운다). */
  activeSlot: ScheduleSlot | null;
  nextSlot: { slot: ScheduleSlot; isTomorrow: boolean } | null;
  currentTrackId: string | null;
  /** 다음에 나올 곡 (노래 목록의 "다음 곡" 표시). */
  nextTrackId: string | null;
  /** 구간 안인데 곡이 없어서 못 트는 중. */
  isMissingTracks: boolean;
}

export type SaveScheduleResult =
  { ok: true; settings: AppSettings } | { ok: false; issues: ScheduleIssue[] };

/** preload가 window.api로 노출하는 기능. 화면은 이것만 쓴다. */
export interface RendererApi {
  requestPlay: () => void;
  requestStop: () => void;
  /** 메인의 재생 지시를 받는다. 반환값을 호출하면 구독이 해제된다. */
  onPlay: (listener: (track: Track) => void) => () => void;
  onStop: (listener: () => void) => () => void;

  listTracks: () => Promise<LibraryTrack[]>;
  /** 음악 폴더 내용이 바뀔 때마다 새 목록을 받는다. */
  onLibraryChanged: (listener: (tracks: LibraryTrack[]) => void) => () => void;
  /** 드롭한 파일을 음악 폴더로 복사한다. 경로 변환은 preload가 한다. */
  addFiles: (files: readonly File[]) => Promise<AddFilesResult>;
  openMusicFolder: () => void;

  /** 곡이 끝났다 / 재생에 실패했다 (main이 다음 곡을 정한다). */
  notifyEnded: (trackId: string) => void;
  notifyError: (trackId: string) => void;
  getStatus: () => Promise<PlayerStatus>;
  onStatus: (listener: (status: PlayerStatus) => void) => () => void;

  getSettings: () => Promise<AppSettings>;
  saveSchedule: (schedule: ScheduleSlot[]) => Promise<SaveScheduleResult>;
  setVolume: (volume: number) => void;
}
