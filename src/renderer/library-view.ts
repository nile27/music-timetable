// 노래 화면 (S-03, Figma 8:2): 곡 수, 폴더 열기, 드래그 영역, 곡 목록(지금 재생 중·다음 재생 표시).
// 곡 목록: 두 번 누르면 그 곡부터 재생, 끌어다 놓아 순서 바꾸기, 휴지통 버튼으로 삭제.
// 무엇을 틀지·순서 저장·삭제는 모두 메인이 하고, 여기서는 부탁만 한다.
import type { AddFilesResult, LibraryTrack } from '../shared/types';
import { applyCover } from './cover';
import { el } from './dom';
import { createIcon } from './icons';
import { MESSAGES } from './messages';
import { moveTrack } from './song-order';

// 추가 결과 안내를 보여준 뒤 원래 안내로 돌아가기까지 (읽을 시간을 준다).
const RESULT_MESSAGE_MS = 8000;
// 목록 안에서 곡 줄을 끌 때 쓰는 데이터 종류. 파일을 끌어 올 때(Files)와 구분한다.
const TRACK_DRAG_TYPE = 'application/x-music-timetable-track';

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
  const hint = el('p', 'songs-hint', MESSAGES.songsHint);
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
    hint,
    list,
    empty,
  );

  let tracks: readonly LibraryTrack[] = [];
  let nowTrackId: string | null = null;
  let nextTrackId: string | null = null;
  /** 지금 끌고 있는 곡 (목록 안에서 끌 때만. 파일을 끌어 올 때는 null). */
  let draggingId: string | null = null;

  const createRow = (track: LibraryTrack, index: number): HTMLLIElement => {
    const thumb = el('div', 'song-thumb');
    applyCover(thumb, track.coverUrl, track.id);
    const text = el(
      'span',
      'song-text',
      el('span', 'song-text-title', track.title),
      track.artist ? el('span', 'song-text-artist', ` - ${track.artist}`) : null,
    );
    const remove = el('button', 'song-delete', createIcon('trash'));
    remove.type = 'button';
    remove.draggable = false;
    remove.setAttribute('aria-label', MESSAGES.deleteTrack(track.title));
    remove.addEventListener('click', () => removeTrack(track));
    // 휴지통 버튼을 빠르게 두 번 눌러도 그 곡이 재생되지 않게 한다.
    remove.addEventListener('dblclick', (event) => event.stopPropagation());

    const row = el('li', 'song-row', el('span', 'song-no', String(index + 1)), thumb, text, remove);
    row.dataset.trackId = track.id;
    row.draggable = true;
    row.addEventListener('dblclick', () => window.api.playTrack(track.id));
    row.addEventListener('dragstart', (event) => {
      if (!event.dataTransfer) return;
      draggingId = track.id;
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData(TRACK_DRAG_TYPE, track.id);
      row.classList.add('is-dragging');
    });
    row.addEventListener('dragend', () => {
      draggingId = null;
      row.classList.remove('is-dragging');
      clearDropMarks();
    });
    return row;
  };

  const applyMarks = (): void => {
    for (const row of list.querySelectorAll<HTMLLIElement>('.song-row')) {
      const isNow = row.dataset.trackId === nowTrackId;
      const isNext = !isNow && row.dataset.trackId === nextTrackId;
      row.classList.toggle('is-now', isNow);
      row.classList.toggle('is-next', isNext);
      row.querySelector('.badge')?.remove();
      // 배지는 휴지통 버튼 앞에 둔다 (버튼 위치가 줄마다 같도록).
      const remove = row.querySelector('.song-delete');
      if (isNow) remove?.before(el('span', 'badge is-now', MESSAGES.badgeNow));
      if (isNext) remove?.before(el('span', 'badge is-next', MESSAGES.badgeNext));
    }
  };

  const renderRows = (): void => {
    count.textContent = MESSAGES.trackCount(tracks.length);
    empty.hidden = tracks.length > 0;
    list.hidden = tracks.length === 0;
    hint.hidden = tracks.length === 0;
    list.replaceChildren(...tracks.map(createRow));
    applyMarks();
  };

  const clearDropMarks = (): void => {
    for (const row of list.querySelectorAll('.is-drop-before, .is-drop-after')) {
      row.classList.remove('is-drop-before', 'is-drop-after');
    }
  };

  /** 끌고 있는 곡을 놓을 위치: 가리킨 줄의 위쪽 절반이면 그 위, 아래쪽 절반이면 그 아래. */
  const findDropTarget = (event: DragEvent): { row: HTMLElement; placeAfter: boolean } | null => {
    const row = (event.target as Element | null)?.closest<HTMLElement>('.song-row');
    if (!row || !row.dataset.trackId) return null;
    const rect = row.getBoundingClientRect();
    return { row, placeAfter: event.clientY > rect.top + rect.height / 2 };
  };

  list.addEventListener('dragover', (event) => {
    if (draggingId === null) return; // 파일을 끌어 온 경우는 드래그 영역에서만 받는다
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    const target = findDropTarget(event);
    clearDropMarks();
    if (target && target.row.dataset.trackId !== draggingId) {
      target.row.classList.add(target.placeAfter ? 'is-drop-after' : 'is-drop-before');
    }
  });

  list.addEventListener('drop', (event) => {
    const movingId = draggingId;
    const target = findDropTarget(event);
    clearDropMarks();
    if (movingId === null || !target?.row.dataset.trackId) return;
    event.preventDefault();
    const order = moveTrack(
      tracks.map((track) => track.id),
      movingId,
      target.row.dataset.trackId,
      target.placeAfter,
    );
    if (!order) return;
    // 메인의 새 목록을 기다리지 않고 바로 옮겨 보여준다. 실패하면 원래 목록으로 되돌린다.
    const previous = tracks;
    const byId = new Map(tracks.map((track) => [track.id, track]));
    tracks = order.flatMap((id) => byId.get(id) ?? []);
    renderRows();
    void window.api
      .reorderTracks(order)
      .then((ok) => {
        if (ok) return;
        tracks = previous;
        renderRows();
        showDropMessage(MESSAGES.reorderFailed, true);
      })
      .catch((error: unknown) => {
        console.error('[library] reorderTracks failed', error);
        tracks = previous;
        renderRows();
        showDropMessage(MESSAGES.reorderFailed, true);
      });
  });

  // 드롭 영역 밖에 떨어뜨려도 브라우저 기본 동작(파일 열기)이 일어나지 않게 막는다.
  for (const type of ['dragover', 'drop'] as const) {
    document.addEventListener(type, (event) => event.preventDefault());
  }
  // dragenter/dragleave는 자식 요소를 지날 때마다 오므로 횟수로 강조 상태를 관리한다.
  let dragDepth = 0;
  dropZone.addEventListener('dragenter', (event) => {
    // 목록의 곡 줄을 끌다가 지나가는 경우는 강조하지 않는다 (파일을 끌어 올 때만).
    if (!event.dataTransfer?.types.includes('Files')) return;
    dragDepth++;
    dropZone.classList.add('is-dragover');
  });
  dropZone.addEventListener('dragleave', (event) => {
    if (!event.dataTransfer?.types.includes('Files')) return;
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

  function removeTrack(track: LibraryTrack): void {
    void window.api
      .removeTrack(track.id)
      .then((ok) =>
        showDropMessage(
          ok ? MESSAGES.removed(track.title) : MESSAGES.removeFailed(track.title),
          true,
        ),
      )
      .catch((error: unknown) => {
        console.error('[library] removeTrack failed', error);
        showDropMessage(MESSAGES.removeFailed(track.title), true);
      });
  }

  return {
    render: (nextTracks) => {
      tracks = nextTracks;
      // 끄는 도중에 목록이 다시 그려지면 끌던 줄이 사라지므로 끌기 상태도 버린다.
      draggingId = null;
      renderRows();
    },
    setMarks: (now, next) => {
      if (now === nowTrackId && next === nextTrackId) return;
      nowTrackId = now;
      nextTrackId = next;
      applyMarks();
    },
  };
}
