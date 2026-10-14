/** 메인이 화면에 재생을 지시할 때 넘기는 곡 정보. */
export interface Track {
  /** 화면에 보여줄 제목 (태그가 없으면 파일 이름). */
  title: string;
  /** media:// 주소. 화면은 로컬 경로를 직접 열 수 없어서 메인이 변환해 준다. */
  url: string;
}

/** preload가 window.api로 노출하는 기능. 화면은 이것만 쓴다. */
export interface RendererApi {
  requestPlay: () => void;
  requestStop: () => void;
  /** 메인의 재생 지시를 받는다. 반환값을 호출하면 구독이 해제된다. */
  onPlay: (listener: (track: Track) => void) => () => void;
  onStop: (listener: () => void) => () => void;
}
