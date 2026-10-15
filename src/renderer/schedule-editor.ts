// 시간표 편집 (S-02, Figma 7:2 왼쪽). 입력할 때마다 검사해서 줄마다 오류를 보여주고(FR-07),
// 오류가 있으면 [저장]을 막는다. 메인도 저장 전에 다시 검사한다.
import { validateSchedule, type ScheduleIssue } from '../shared/schedule';
import { normalizeTimeInput } from '../shared/time';
import type { ScheduleSlot } from '../shared/types';
import { el } from './dom';
import { createIcon } from './icons';
import { MESSAGES } from './messages';

interface SlotRow {
  name: HTMLInputElement;
  start: HTMLInputElement;
  end: HTMLInputElement;
  error: HTMLElement;
  errorText: HTMLElement;
}

function createInput(kind: 'name' | 'time', value: string, label: string): HTMLInputElement {
  const input = el('input', `slot-input is-${kind}`);
  input.type = 'text';
  input.value = value;
  input.setAttribute('aria-label', label);
  if (kind === 'time') {
    // 시각은 "08:30" 모양 그대로 보여준다 (type=time은 "오전 8:30"으로 바뀌어 칸에 안 들어감).
    input.inputMode = 'numeric';
    input.maxLength = 5;
  }
  return input;
}

export function setupScheduleEditor(container: HTMLElement): void {
  const rowsBox = el('div', 'slot-rows');
  const addButton = el(
    'button',
    'btn-add-slot',
    createIcon('plus'),
    el('span', '', MESSAGES.addSlot),
  );
  addButton.type = 'button';
  const saveMessage = el('p', 'save-message');
  saveMessage.setAttribute('aria-live', 'polite');
  const saveButton = el('button', 'btn-save', MESSAGES.saveSchedule);
  saveButton.type = 'button';

  container.append(
    el(
      'section',
      'slots',
      el('h2', 'section-title', MESSAGES.scheduleSection),
      el(
        'div',
        'slot-grid slot-head',
        el('span', '', MESSAGES.scheduleName),
        el('span', '', MESSAGES.scheduleStart),
        el('span', ''),
        el('span', '', MESSAGES.scheduleEnd),
      ),
      rowsBox,
      addButton,
      el('div', 'save-area', saveMessage, saveButton),
    ),
  );

  /** 편집 중인 시간표. 저장하면 메인이 정렬한 결과로 바뀐다. */
  let draft: ScheduleSlot[] = [];
  let rows: SlotRow[] = [];

  const showMessage = (text: string, kind: 'error' | 'success' | ''): void => {
    saveMessage.textContent = text;
    saveMessage.classList.toggle('is-error', kind === 'error');
    saveMessage.classList.toggle('is-success', kind === 'success');
  };

  /** 입력칸을 다시 만들지 않고 오류 표시만 바꾼다 (입력 중 커서가 튀지 않게). */
  const refreshValidation = (): ScheduleIssue[] => {
    const issues = validateSchedule(draft);
    rows.forEach((row, index) => {
      const reasons = issues.filter((issue) => issue.index === index).map((issue) => issue.reason);
      const hasTimeError = reasons.some((reason) => reason !== 'empty-name');
      row.name.classList.toggle('is-error', reasons.includes('empty-name'));
      row.start.classList.toggle('is-error', hasTimeError);
      row.end.classList.toggle('is-error', hasTimeError);
      row.errorText.textContent = reasons.map((reason) => MESSAGES.scheduleIssue[reason]).join(' ');
      row.error.hidden = reasons.length === 0;
    });
    saveButton.disabled = issues.length > 0;
    if (issues.length > 0) showMessage(MESSAGES.scheduleInvalid, 'error');
    else if (saveMessage.classList.contains('is-error')) showMessage('', '');
    return issues;
  };

  const renderRows = (): void => {
    rows = [];
    const elements = draft.map((slot, index) => {
      const name = createInput('name', slot.name, MESSAGES.scheduleName);
      const start = createInput('time', slot.start, MESSAGES.scheduleStart);
      const end = createInput('time', slot.end, MESSAGES.scheduleEnd);
      const errorText = el('span', '');
      const error = el('p', 'slot-error', createIcon('alert'), errorText);
      error.hidden = true;
      rows.push({ name, start, end, error, errorText });

      const update = (patch: Partial<ScheduleSlot>): void => {
        draft[index] = { ...draft[index], ...patch };
        if (saveMessage.classList.contains('is-success')) showMessage('', '');
        refreshValidation();
      };
      name.addEventListener('input', () => update({ name: name.value }));
      for (const [input, key] of [
        [start, 'start'],
        [end, 'end'],
      ] as const) {
        input.addEventListener('input', () => update({ [key]: input.value }));
        // "830", "8:30"처럼 적어도 칸을 떠날 때 "08:30"으로 맞춰 준다.
        input.addEventListener('blur', () => {
          const normalized = normalizeTimeInput(input.value);
          if (normalized && normalized !== input.value) {
            input.value = normalized;
            update({ [key]: normalized });
          }
        });
      }

      const remove = el('button', 'slot-delete', createIcon('trash'));
      remove.type = 'button';
      remove.setAttribute('aria-label', MESSAGES.deleteSlot(slot.name));
      remove.addEventListener('click', () => {
        draft = draft.filter((_, i) => i !== index);
        renderRows();
      });

      return el(
        'div',
        'slot-grid slot',
        name,
        start,
        el('span', 'slot-tilde', '~'),
        end,
        remove,
        error,
      );
    });
    rowsBox.replaceChildren(...elements);
    refreshValidation();
  };

  addButton.addEventListener('click', () => {
    draft = [...draft, { name: MESSAGES.newSlotName, start: '', end: '' }];
    renderRows();
    rows.at(-1)?.start.focus();
  });

  saveButton.addEventListener('click', () => {
    if (refreshValidation().length > 0) return;
    void window.api
      .saveSchedule(draft)
      .then((result) => {
        if (result.ok) {
          draft = result.settings.schedule.map((slot) => ({ ...slot }));
          renderRows();
          showMessage(MESSAGES.scheduleSaved, 'success');
        } else {
          showMessage(MESSAGES.scheduleInvalid, 'error');
        }
      })
      .catch((error: unknown) => {
        console.error('[schedule] save failed', error);
        showMessage(MESSAGES.scheduleSaveFailed, 'error');
      });
  });

  void window.api.getSettings().then((settings) => {
    draft = settings.schedule.map((slot) => ({ ...slot }));
    renderRows();
  });
}
