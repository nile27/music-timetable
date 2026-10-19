// 노래 목록에서 끌어다 놓은 결과로 새 재생 순서를 만든다. DOM과 상관없는 순수 함수라 테스트한다.

/**
 * movingId 곡을 targetId 곡의 위(placeAfter=false) 또는 아래(true)로 옮긴 순서.
 * 위치가 그대로이거나 모르는 곡이면 null (저장할 필요 없음).
 */
export function moveTrack(
  ids: readonly string[],
  movingId: string,
  targetId: string,
  placeAfter: boolean,
): string[] | null {
  if (movingId === targetId || !ids.includes(movingId) || !ids.includes(targetId)) return null;
  const rest = ids.filter((id) => id !== movingId);
  const at = rest.indexOf(targetId) + (placeAfter ? 1 : 0);
  const moved = [...rest.slice(0, at), movingId, ...rest.slice(at)];
  return moved.every((id, i) => id === ids[i]) ? null : moved;
}
