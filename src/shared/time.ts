// 시각·날짜 유틸. 날짜 라이브러리 없이 "자정부터의 분"으로 비교한다 (코드 컨벤션 6장).

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** "HH:mm" → 자정부터의 분. 형식이 틀리면 null. */
export function parseTimeToMinutes(time: string): number | null {
  const match = TIME_PATTERN.exec(time);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * 현재 시각을 자정부터의 분으로. 초는 버린다.
 * 그래서 08:59:59는 539분(09:00 미만 → 구간 안), 09:00:00은 540분(구간 밖)이 된다.
 */
export function getMinutesOfDay(now: Date): number {
  return now.getHours() * 60 + now.getMinutes();
}

/**
 * 로컬 시간 기준 "YYYY-MM-DD".
 * toISOString()은 UTC라 한국 오전 9시 전에는 전날 날짜가 나오므로 쓰지 않는다.
 */
export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** "13:00" → 오후 1:00 표시에 필요한 값. 문구(오전/오후)는 화면의 messages.ts가 붙인다. */
export function toClock12(
  time: string,
): { isAfternoon: boolean; hour: number; minute: string } | null {
  const minutes = parseTimeToMinutes(time);
  if (minutes === null) return null;
  const hours = Math.floor(minutes / 60);
  return {
    isAfternoon: hours >= 12,
    hour: hours % 12 === 0 ? 12 : hours % 12,
    minute: time.slice(3),
  };
}

/** 곡 재생 시간 표시: 83.4초 → "1:23". 모르는 값(NaN·무한대·음수)은 "0:00". */
export function formatMediaTime(seconds: number): string {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * 사람이 입력한 시각을 "HH:mm"으로 맞춘다. 맞출 수 없으면 null.
 * 연구원님이 "8:30", "830", "0830", "8.30"처럼 적어도 "08:30"으로 받아들이기 위함.
 */
export function normalizeTimeInput(text: string): string | null {
  const trimmed = text.trim();
  const match = /^(\d{1,2})[:.]?(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const time = `${match[1].padStart(2, '0')}:${match[2]}`;
  return parseTimeToMinutes(time) === null ? null : time;
}
