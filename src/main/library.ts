// LibraryManager: 음악 폴더 읽기·감시, 드롭된 파일 복사, 태그 정리.
import { constants, watch, type FSWatcher } from 'node:fs';
import { copyFile, mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { toMediaUrl } from '../shared/media-url';
import type { AddFilesResult, LibraryTrack } from '../shared/types';
import {
  isAudioFileName,
  isImageFileName,
  pickDefaultCover,
  planDroppedFiles,
  sortTrackNames,
  toTrackInfo,
} from './library-rules';
import { readTrackTags, type TrackTags } from './track-tags';

// 큰 파일을 복사하는 동안 변경 이벤트가 수십 번 오므로 잠잠해질 때까지 기다렸다가 한 번만 다시 읽는다.
const RESCAN_DEBOUNCE_MS = 300;
// 감시가 끊기면(폴더 삭제 등) 잠시 뒤 폴더를 다시 만들고 감시를 재시작한다.
const WATCH_RETRY_MS = 2000;

interface CachedTags {
  mtimeMs: number;
  size: number;
  tags: TrackTags;
}

export class MusicLibrary {
  private tracks: LibraryTrack[] = [];
  private defaultCovers: string[] = [];
  /** 파일 이름 → 태그. 수정 시각·크기가 같으면 다시 읽지 않는다 (곡이 많아도 빠르게). */
  private readonly tagCache = new Map<string, CachedTags>();
  private watcher: FSWatcher | null = null;
  private rescanTimer: NodeJS.Timeout | null = null;
  private retryTimer: NodeJS.Timeout | null = null;
  private scanning: Promise<void> | null = null;
  private isRescanQueued = false;

  constructor(
    private readonly musicDir: string,
    private readonly defaultCoverDir: string,
    private readonly onChange: (tracks: LibraryTrack[]) => void,
  ) {}

  async start(): Promise<void> {
    await this.ensureMusicDir();
    this.defaultCovers = await this.readDefaultCovers();
    await this.rescan();
    this.startWatching();
  }

  stop(): void {
    this.watcher?.close();
    this.watcher = null;
    if (this.rescanTimer) clearTimeout(this.rescanTimer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
  }

  getTracks(): LibraryTrack[] {
    return this.tracks;
  }

  /** 드롭된 파일을 음악 폴더로 복사한다. 경로는 화면에서 온 값이므로 여기서 다시 검사한다. */
  async addFiles(sourcePaths: readonly string[]): Promise<AddFilesResult> {
    await this.ensureMusicDir();
    const existing = await this.readAudioFileNames();
    const plan = planDroppedFiles(sourcePaths, existing, path);
    const result: AddFilesResult = {
      added: [],
      duplicates: plan.duplicates,
      notAudio: plan.notAudio,
      failed: [],
    };

    for (const { sourcePath, fileName } of plan.toCopy) {
      try {
        // 이름이 .mp3여도 폴더일 수 있다.
        if (!(await stat(sourcePath)).isFile()) {
          result.notAudio.push(fileName);
          continue;
        }
        // COPYFILE_EXCL: 검사와 복사 사이에 같은 이름이 생겨도 덮어쓰지 않는다.
        await copyFile(sourcePath, path.join(this.musicDir, fileName), constants.COPYFILE_EXCL);
        result.added.push(fileName);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
          result.duplicates.push(fileName);
        } else {
          console.warn(`[library] 복사 실패: ${sourcePath}`, error);
          result.failed.push(fileName);
        }
      }
    }

    // 감시 이벤트가 와도 다시 읽지만, 결과 안내와 목록이 같이 바뀌도록 바로 한 번 읽는다.
    if (result.added.length > 0) await this.rescan();
    return result;
  }

  private async ensureMusicDir(): Promise<void> {
    await mkdir(this.musicDir, { recursive: true });
  }

  private async readDefaultCovers(): Promise<string[]> {
    try {
      const names = await readdir(this.defaultCoverDir);
      return names.filter(isImageFileName);
    } catch {
      console.warn(`[library] 기본 커버 폴더를 읽지 못했습니다: ${this.defaultCoverDir}`);
      return [];
    }
  }

  /** 폴더 바로 안의 음악 파일 이름 (하위 폴더는 보지 않는다: FR-20 "폴더 1개"). */
  private async readAudioFileNames(): Promise<string[]> {
    const entries = await readdir(this.musicDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && isAudioFileName(entry.name))
      .map((entry) => entry.name);
  }

  /** 동시에 여러 번 불려도 한 번에 하나만 돌고, 도는 중에 온 요청은 끝난 뒤 한 번 더 돈다. */
  private rescan(): Promise<void> {
    if (this.scanning) {
      this.isRescanQueued = true;
      return this.scanning;
    }
    this.scanning = this.scanOnce()
      .catch((error: unknown) => {
        console.warn('[library] 음악 폴더를 읽지 못했습니다', error);
        // 폴더째 지워진 경우: 감시도 이미 죽었을 수 있으니 폴더를 다시 만들고 감시를 재시작한다.
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') this.restartWatching();
      })
      .finally(() => {
        this.scanning = null;
        if (this.isRescanQueued) {
          this.isRescanQueued = false;
          void this.rescan();
        }
      });
    return this.scanning;
  }

  private async scanOnce(): Promise<void> {
    const names = sortTrackNames(await this.readAudioFileNames());
    const tracks: LibraryTrack[] = [];

    for (const fileName of names) {
      const filePath = path.join(this.musicDir, fileName);
      const tags = await this.getTags(fileName, filePath);
      if (!tags) continue; // 읽는 사이 지워진 파일
      const { title, artist } = toTrackInfo(fileName, tags);
      const defaultCover = pickDefaultCover(fileName, this.defaultCovers);
      tracks.push({
        id: fileName,
        title,
        artist,
        url: toMediaUrl('audio', filePath),
        coverUrl: tags.hasCover
          ? toMediaUrl('cover', filePath)
          : defaultCover
            ? toMediaUrl('default-cover', path.join(this.defaultCoverDir, defaultCover))
            : null,
      });
    }

    // 지워진 파일의 캐시는 버린다.
    for (const cachedName of this.tagCache.keys()) {
      if (!names.includes(cachedName)) this.tagCache.delete(cachedName);
    }

    if (!isSameTrackList(this.tracks, tracks)) {
      this.tracks = tracks;
      this.onChange(tracks);
    }
  }

  private async getTags(fileName: string, filePath: string): Promise<TrackTags | null> {
    let info;
    try {
      info = await stat(filePath);
    } catch {
      return null;
    }
    const cached = this.tagCache.get(fileName);
    if (cached && cached.mtimeMs === info.mtimeMs && cached.size === info.size) return cached.tags;

    let tags: TrackTags;
    try {
      tags = await readTrackTags(filePath);
    } catch (error) {
      // 깨진 파일이나 아직 복사 중인 파일. 파일 이름으로 보여주고, 복사가 끝나면
      // 수정 시각이 바뀌어 다시 읽힌다.
      console.warn(`[library] 태그를 읽지 못했습니다: ${fileName}`, error);
      tags = { hasCover: false };
    }
    this.tagCache.set(fileName, { mtimeMs: info.mtimeMs, size: info.size, tags });
    return tags;
  }

  private scheduleRescan(): void {
    if (this.rescanTimer) clearTimeout(this.rescanTimer);
    this.rescanTimer = setTimeout(() => {
      this.rescanTimer = null;
      void this.rescan();
    }, RESCAN_DEBOUNCE_MS);
  }

  private startWatching(): void {
    try {
      this.watcher = watch(this.musicDir, () => this.scheduleRescan());
      this.watcher.on('error', (error) => {
        console.warn('[library] 폴더 감시가 끊겼습니다. 다시 시작합니다.', error);
        this.restartWatching();
      });
    } catch (error) {
      console.warn('[library] 폴더 감시를 시작하지 못했습니다. 다시 시도합니다.', error);
      this.restartWatching();
    }
  }

  private restartWatching(): void {
    this.watcher?.close();
    this.watcher = null;
    if (this.retryTimer) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.ensureMusicDir()
        .then(() => {
          this.startWatching();
          return this.rescan();
        })
        .catch((error: unknown) => {
          console.warn('[library] 음악 폴더를 다시 만들지 못했습니다.', error);
          this.restartWatching();
        });
    }, WATCH_RETRY_MS);
  }
}

function isSameTrackList(a: readonly LibraryTrack[], b: readonly LibraryTrack[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (track, i) =>
        track.id === b[i].id &&
        track.title === b[i].title &&
        track.artist === b[i].artist &&
        track.coverUrl === b[i].coverUrl,
    )
  );
}
