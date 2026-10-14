// 곡 파일 내장 태그(제목·가수·커버) 읽기. music-metadata는 ESM 전용이라 import로만 쓴다.
import { parseFile, selectCover } from 'music-metadata';

export interface TrackTags {
  title?: string;
  artist?: string;
  hasCover: boolean;
}

/** 태그를 읽는다. 깨진 파일·복사 중인 파일이면 예외를 던지므로 호출하는 쪽에서 처리한다. */
export async function readTrackTags(filePath: string): Promise<TrackTags> {
  // 곡 길이 계산은 파일 전체를 훑어야 해서 느리다. 목록에는 필요 없으므로 끈다.
  const { common } = await parseFile(filePath, { duration: false });
  return {
    title: common.title,
    artist: common.artist,
    hasCover: (common.picture?.length ?? 0) > 0,
  };
}

/** 내장 커버 이미지를 읽는다. 없거나 이미지 형식이 아니면 null. */
export async function readEmbeddedCover(
  filePath: string,
): Promise<{ data: Uint8Array<ArrayBuffer>; mimeType: string } | null> {
  const { common } = await parseFile(filePath, { duration: false });
  const cover = selectCover(common.picture);
  if (!cover || !cover.format.startsWith('image/')) return null;
  // slice()로 독립된 ArrayBuffer를 가진 사본을 만들어 Response 본문 타입에 맞춘다.
  return { data: cover.data.slice(), mimeType: cover.format };
}
