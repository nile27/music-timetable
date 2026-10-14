/** 메인이 화면에 재생을 지시할 때 넘기는 곡 정보. */
export interface Track {
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
}
