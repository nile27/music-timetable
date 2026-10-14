// 사용자에게 보이는 문구는 모두 여기에 모은다 (화면 코드에 직접 쓰지 않는다).
export const MESSAGES = {
  appTitle: '음악 시간표',
  play: '재생',
  stop: '정지',
  statusStopped: '정지됨',
  statusPlaying: (title: string): string => `재생 중: ${title}`,
  playFailed: '음악을 재생하지 못했습니다',

  // 노래 화면 (S-03)
  dropHint: '여기에 음악 파일을 끌어다 놓으세요',
  trackCount: (count: number): string => `총 ${count}곡`,
  openFolder: '폴더 열기',
  emptyLibrary: '아직 노래가 없어요. 위에 파일을 끌어다 놓아주세요',
  added: (count: number): string => `${count}곡을 추가했어요.`,
  duplicates: (names: readonly string[]): string =>
    `이미 있는 노래라서 제외했어요: ${names.join(', ')}`,
  notAudio: (names: readonly string[]): string =>
    `음악 파일이 아니라서 제외했어요: ${names.join(', ')}`,
  addFailed: (names: readonly string[]): string => `노래를 추가하지 못했어요: ${names.join(', ')}`,
} as const;
