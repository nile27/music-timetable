// 무인 운영 중 문제를 나중에 추적하기 위한 로그 파일 (컨벤션 8장).
// 위치: userData/logs/main.log (Windows: %APPDATA%\music-timetable\logs\main.log)
// 사용자에게 보이는 문구가 아니라 개발자용 기록이라 기술적 원인을 그대로 남긴다.
import log from 'electron-log/main';

// 1MB가 넘으면 main.old.log로 넘기고 새로 쓴다 (몇 달 켜 둬도 디스크를 채우지 않게).
log.transports.file.maxSize = 1024 * 1024;
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}] [{level}] {text}';

export const logger = {
  info: (...params: unknown[]): void => log.info(...params),
  warn: (...params: unknown[]): void => log.warn(...params),
  error: (...params: unknown[]): void => log.error(...params),
  /** 로그 파일 위치 (시작 로그·설명서 안내용). */
  getFilePath: (): string => log.transports.file.getFile().path,
};
