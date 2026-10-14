// 시간표 편집 (S-02) 임시 구현. 실제 디자인은 6단계에서 Figma 기준으로 바꾼다.
import { validateSchedule, type ScheduleIssue } from '../shared/schedule';
import type { ScheduleSlot } from '../shared/types';
import { MESSAGES } from './messages';

export interface ScheduleEditorElements {
  title: HTMLElement;
  rows: HTMLElement;
  addButton: HTMLButtonElement;
  saveButton: HTMLButtonElement;
  message: HTMLElement;
}

function createInput(type: 'text' | 'time', value: string, label: string): HTMLInputElement {
  const input = document.createElement('input');
  input.type = type;
  input.value = value;
  input.setAttribute('aria-label', label);
  return input;
}

export function setupScheduleEditor(elements: ScheduleEditorElements): void {
  const { title, rows, addButton, saveButton, message } = elements;
  title.textContent = MESSAGES.scheduleTitle;
  addButton.textContent = MESSAGES.addSlot;
  saveButton.textContent = MESSAGES.saveSchedule;

  /** 저장 전 편집 중인 시간표. 저장하면 메인이 정렬한 결과로 바뀐다. */
  let draft: ScheduleSlot[] = [];

  const render = (issues: readonly ScheduleIssue[] = []): void => {
    const header = document.createElement('div');
    header.className = 'slot-row slot-header';
    for (const text of [MESSAGES.scheduleName, MESSAGES.scheduleStart, MESSAGES.scheduleEnd]) {
      const cell = document.createElement('span');
      cell.textContent = text;
      header.append(cell);
    }

    const slotRows = draft.map((slot, index) => {
      const row = document.createElement('div');
      row.className = 'slot-row';
      const rowIssues = issues.filter((issue) => issue.index === index);
      row.classList.toggle('has-error', rowIssues.length > 0);

      const name = createInput('text', slot.name, MESSAGES.scheduleName);
      const start = createInput('time', slot.start, MESSAGES.scheduleStart);
      const end = createInput('time', slot.end, MESSAGES.scheduleEnd);
      name.addEventListener('input', () => (draft[index] = { ...draft[index], name: name.value }));
      start.addEventListener(
        'input',
        () => (draft[index] = { ...draft[index], start: start.value }),
      );
      end.addEventListener('input', () => (draft[index] = { ...draft[index], end: end.value }));

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = MESSAGES.deleteSlot;
      remove.addEventListener('click', () => {
        draft = draft.filter((_, i) => i !== index);
        render();
      });

      const error = document.createElement('span');
      error.className = 'slot-error';
      error.textContent = rowIssues.map((issue) => MESSAGES.scheduleIssue[issue.reason]).join(' ');

      row.append(name, start, end, remove, error);
      return row;
    });

    rows.replaceChildren(header, ...slotRows);
  };

  addButton.addEventListener('click', () => {
    draft = [...draft, { name: '', start: '', end: '' }];
    message.textContent = '';
    render();
  });

  saveButton.addEventListener('click', () => {
    // 저장 전에 먼저 알려준다 (FR-07). 메인도 다시 검사한다.
    const issues = validateSchedule(draft);
    if (issues.length > 0) {
      message.textContent = MESSAGES.scheduleInvalid;
      render(issues);
      return;
    }
    void window.api
      .saveSchedule(draft)
      .then((result) => {
        if (result.ok) {
          draft = result.settings.schedule.map((slot) => ({ ...slot }));
          message.textContent = MESSAGES.scheduleSaved;
          render();
        } else {
          message.textContent = MESSAGES.scheduleInvalid;
          render(result.issues);
        }
      })
      .catch((error: unknown) => {
        console.error('[schedule] save failed', error);
        message.textContent = MESSAGES.scheduleSaveFailed;
      });
  });

  void window.api.getSettings().then((settings) => {
    draft = settings.schedule.map((slot) => ({ ...slot }));
    render();
  });
}
