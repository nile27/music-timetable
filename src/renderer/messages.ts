// 사용자에게 보이는 문구는 모두 여기에 모은다 (화면 코드에 직접 쓰지 않는다).
export const MESSAGES = {
  appTitle: '음악 시간표',
  play: '재생',
  stop: '정지',
  statusStopped: '정지됨',
  statusPlaying: (title: string): string => `재생 중: ${title}`,
  playFailed: '음악을 재생하지 못했습니다',
} as const;
