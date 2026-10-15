// 노래 화면 (S-03, Figma 8:2): 곡 수, 폴더 열기, 드래그 영역, 곡 목록(지금 재생 중·다음 재생 표시).
import type { AddFilesResult, LibraryTrack } from '../shared/types';
import { applyCover } from './cover';
import { el } from './dom';
import { createIcon } from './icons';
import { MESSAGES } from './messages';

// 추가 결과 안내를 보여준 뒤 원래 안내로 돌아가기까지 (읽을 시간을 준다).
const RESULT_MESSAGE_MS = 8000;

export interface LibraryView {
  render: (tracks: readonly LibraryTrack[]) => void;
  /** 지금 재생 중인 곡(소리가 날 때만)과 다음 곡 표시. */
  setMarks: (nowTrackId: string | null, nextTrackId: string | null) => void;
}

function describeAddResult(result: AddFilesResult): string[] {
  const lines: string[] = [];
  if (result.added.length > 0) lines.push(MESSAGES.added(result.added.length));
  if (result.duplicates.length > 0) lines.push(MESSAGES.duplicates(result.duplicates));
  if (result.notAudio.length > 0) lines.push(MESSAGES.notAudio(result.notAudio));
  if (result.failed.length > 0) lines.push(MESSAGES.addFailed(result.failed));
  return lines;
}

export function setupLibraryView(container: HTMLElement): LibraryView {
  const count = el('span', 'song-count');
  const openFolderButton = el(
    'button',
    'btn-open-folder',
    createIcon('folder'),
    el('span', '', MESSAGES.openFolder),
  );
  openFolderButton.type = 'button';
  openFolderButton.addEventListener('click', () => window.api.openMusicFolder());

  const dropText = el('p', 'dropzone-text', MESSAGES.dropHint);
  dropText.setAttribute('aria-live', 'polite');
  const dropZone = el('div', 'dropzone', createIcon('upload'), dropText);
  const list = el('ul', 'song-list');
  const empty = el('p', 'songs-empty', MESSAGES.emptyLibrary);
  empty.hidden = true;

  container.replaceChildren(
    el(
      'div',
      'songs-header',
      el('div', 'songs-title-row', el('h1', 'page-title', MESSAGES.songsTitle), count),
      openFolderButton,
    ),
    dropZone,
    list,
    empty,
  );

  let nowTrackId: string | null = null;
  let nextTrackId: string | null = null;

  const createRow = (track: LibraryTrack, index: number): HTMLLIElement => {
    const thumb = el('div', 'song-thumb');
    applyCover(thumb, track.coverUrl, track.id);
    const text = el(
      'span',
      'song-text',
      el('span', 'song-text-title', track.title),
      track.artist ? el('span', 'song-text-artist', ` - ${track.artist}`) : null,
    );
    const row = el('li', 'song-row', el('span', 'song-no', String(index + 1)), thumb, text);
    row.dataset.trackId = track.id;
    return row;
  };

  const applyMarks = (): void => {
    for (const row of list.querySelectorAll<HTMLLIElement>('.song-row')) {
      const isNow = row.dataset.trackId === nowTrackId;
      const isNext = !isNow && row.dataset.trackId === nextTrackId;
      row.classList.toggle('is-now', isNow);
      row.classList.toggle('is-next', isNext);
      row.querySelector('.badge')?.remove();
      if (isNow) row.append(el('span', 'badge is-now', MESSAGES.badgeNow));
      if (isNext) row.append(el('span', 'badge is-next', MESSAGES.badgeNext));
    }
  };

  // 드롭 영역 밖에 떨어뜨려도 브라우저 기본 동작(파일 열기)이 일어나지 않게 막는다.
  for (const type of ['dragover', 'drop'] as const) {
    document.addEventListener(type, (event) => event.preventDefault());
  }
  // dragenter/dragleave는 자식 요소를 지날 때마다 오므로 횟수로 강조 상태를 관리한다.
  let dragDepth = 0;
  dropZone.addEventListener('dragenter', () => {
    dragDepth++;
    dropZone.classList.add('is-dragover');
  });
  dropZone.addEventListener('dragleave', () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) dropZone.classList.remove('is-dragover');
  });

  let resetTimer: number | undefined;
  const showDropMessage = (text: string, isResult: boolean): void => {
    window.clearTimeout(resetTimer);
    dropText.textContent = text;
    dropText.classList.toggle('is-result', isResult);
    if (isResult) {
      resetTimer = window.setTimeout(
        () => showDropMessage(MESSAGES.dropHint, false),
        RESULT_MESSAGE_MS,
      );
    }
  };

  dropZone.addEventListener('drop', (event) => {
    dragDepth = 0;
    dropZone.classList.remove('is-dragover');
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length === 0) return;
    void window.api
      .addFiles(files)
      .then((result) => showDropMessage(describeAddResult(result).join('\n'), true))
      .catch((error: unknown) => {
        console.error('[library] addFiles failed', error);
        showDropMessage(MESSAGES.addFailed(files.map((file) => file.name)), true);
      });
  });

  return {
    render: (tracks) => {
      count.textContent = MESSAGES.trackCount(tracks.length);
      empty.hidden = tracks.length > 0;
      list.hidden = tracks.length === 0;
      list.replaceChildren(...tracks.map(createRow));
      applyMarks();
    },
    setMarks: (now, next) => {
      if (now === nowTrackId && next === nextTrackId) return;
      nowTrackId = now;
      nextTrackId = next;
      applyMarks();
    },
  };
}
