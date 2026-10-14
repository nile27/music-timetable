// 노래 화면 (S-03) 임시 구현. 실제 디자인은 6단계에서 Figma 기준으로 바꾼다.
import type { AddFilesResult, LibraryTrack } from '../shared/types';
import { MESSAGES } from './messages';

export interface LibraryViewElements {
  dropZone: HTMLElement;
  dropMessage: HTMLElement;
  count: HTMLElement;
  openFolderButton: HTMLButtonElement;
  list: HTMLUListElement;
  empty: HTMLElement;
}

function describeAddResult(result: AddFilesResult): string[] {
  const lines: string[] = [];
  if (result.added.length > 0) lines.push(MESSAGES.added(result.added.length));
  if (result.duplicates.length > 0) lines.push(MESSAGES.duplicates(result.duplicates));
  if (result.notAudio.length > 0) lines.push(MESSAGES.notAudio(result.notAudio));
  if (result.failed.length > 0) lines.push(MESSAGES.addFailed(result.failed));
  return lines;
}

function createTrackItem(track: LibraryTrack, index: number): HTMLLIElement {
  const item = document.createElement('li');
  item.className = 'track';

  const number = document.createElement('span');
  number.className = 'track-number';
  number.textContent = `${index + 1}.`;

  // 커버가 없거나 못 읽으면 단색 배경(.cover 기본 스타일)만 남긴다.
  const cover = document.createElement('div');
  cover.className = 'cover';
  if (track.coverUrl) {
    const image = document.createElement('img');
    image.src = track.coverUrl;
    image.alt = '';
    image.loading = 'lazy';
    image.addEventListener('error', () => image.remove());
    cover.append(image);
  }

  const text = document.createElement('div');
  text.className = 'track-text';
  const title = document.createElement('span');
  title.className = 'track-title';
  title.textContent = track.title;
  text.append(title);
  if (track.artist) {
    const artist = document.createElement('span');
    artist.className = 'track-artist';
    artist.textContent = track.artist;
    text.append(artist);
  }

  const nextMark = document.createElement('span');
  nextMark.className = 'next-mark';
  nextMark.textContent = MESSAGES.nextTrack;

  item.dataset.trackId = track.id;
  item.append(number, cover, text, nextMark);
  return item;
}

export interface LibraryView {
  /** 다음에 나올 곡 표시 (메인 상태 알림으로 갱신). */
  setNextTrackId: (trackId: string | null) => void;
}

export function setupLibraryView(elements: LibraryViewElements): LibraryView {
  const { dropZone, dropMessage, count, openFolderButton, list, empty } = elements;

  dropMessage.textContent = MESSAGES.dropHint;
  openFolderButton.textContent = MESSAGES.openFolder;
  empty.textContent = MESSAGES.emptyLibrary;
  openFolderButton.addEventListener('click', () => window.api.openMusicFolder());

  let nextTrackId: string | null = null;
  const markNextTrack = (): void => {
    for (const item of list.children) {
      if (item instanceof HTMLElement) {
        item.classList.toggle('is-next', item.dataset.trackId === nextTrackId);
      }
    }
  };

  const render = (tracks: readonly LibraryTrack[]): void => {
    count.textContent = MESSAGES.trackCount(tracks.length);
    empty.hidden = tracks.length > 0;
    list.replaceChildren(...tracks.map(createTrackItem));
    markNextTrack();
  };

  void window.api.listTracks().then(render);
  window.api.onLibraryChanged(render);

  // 드롭 영역 밖에 떨어뜨려도 브라우저 기본 동작(파일 열기)이 일어나지 않게 막는다.
  for (const type of ['dragover', 'drop'] as const) {
    document.addEventListener(type, (event) => event.preventDefault());
  }

  // dragenter/dragleave는 자식 요소를 지날 때마다 오므로 횟수로 강조 상태를 관리한다.
  let dragDepth = 0;
  dropZone.addEventListener('dragenter', () => {
    dragDepth++;
    dropZone.classList.add('is-dragging');
  });
  dropZone.addEventListener('dragleave', () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) dropZone.classList.remove('is-dragging');
  });
  dropZone.addEventListener('drop', (event) => {
    dragDepth = 0;
    dropZone.classList.remove('is-dragging');
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length === 0) return;

    void window.api
      .addFiles(files)
      .then((result) => {
        dropMessage.textContent = describeAddResult(result).join('\n') || MESSAGES.dropHint;
      })
      .catch((error: unknown) => {
        console.error('[library] addFiles failed', error);
        dropMessage.textContent = MESSAGES.addFailed(files.map((file) => file.name));
      });
  });

  return {
    setNextTrackId: (trackId) => {
      nextTrackId = trackId;
      markNextTrack();
    },
  };
}
