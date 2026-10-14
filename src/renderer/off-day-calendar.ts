// 쉬는 날 달력 (S-02) 임시 구현. 실제 디자인은 6단계에서 Figma 기준으로 바꾼다.
// 주말은 회색(변경 불가), 내장 공휴일은 이름 표시(변경 불가), 평일을 누르면 쉬는 날 지정/해제.
import { isWeekend } from '../shared/day-rules';
import { toDateKey } from '../shared/time';
import { MESSAGES } from './messages';

export interface OffDayCalendarElements {
  title: HTMLElement;
  hint: HTMLElement;
  monthLabel: HTMLElement;
  previousButton: HTMLButtonElement;
  nextButton: HTMLButtonElement;
  grid: HTMLElement;
}

export function setupOffDayCalendar(elements: OffDayCalendarElements): void {
  const { title, hint, monthLabel, previousButton, nextButton, grid } = elements;
  title.textContent = MESSAGES.offDayTitle;
  hint.textContent = MESSAGES.offDayHint;
  previousButton.textContent = MESSAGES.previousMonth;
  nextButton.textContent = MESSAGES.nextMonth;

  const today = new Date();
  let year = today.getFullYear();
  let month = today.getMonth(); // 0~11
  let holidays = new Map<string, string>();
  let offDays = new Set<string>();

  const createDayCell = (date: Date): HTMLElement => {
    const dateKey = toDateKey(date);
    const holidayName = holidays.get(dateKey);
    const isFixedOff = isWeekend(date) || holidayName !== undefined;

    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'day';
    cell.classList.toggle('is-weekend', isWeekend(date));
    cell.classList.toggle('is-holiday', holidayName !== undefined);
    cell.classList.toggle('is-off-day', offDays.has(dateKey));
    cell.classList.toggle('is-today', dateKey === toDateKey(today));
    cell.disabled = isFixedOff;
    cell.setAttribute('aria-pressed', String(offDays.has(dateKey)));

    const number = document.createElement('span');
    number.className = 'day-number';
    number.textContent = String(date.getDate());
    const label = document.createElement('span');
    label.className = 'day-label';
    label.textContent = holidayName ?? (offDays.has(dateKey) ? MESSAGES.offDayMark : '');
    if (holidayName) cell.title = holidayName;
    cell.append(number, label);

    if (!isFixedOff) {
      cell.addEventListener('click', () => {
        void window.api.toggleOffDay(dateKey).then((next) => {
          offDays = new Set(next);
          render();
        });
      });
    }
    return cell;
  };

  const render = (): void => {
    monthLabel.textContent = MESSAGES.monthTitle(year, month + 1);
    const headers = MESSAGES.weekdays.map((name) => {
      const header = document.createElement('span');
      header.className = 'weekday';
      header.textContent = name;
      return header;
    });

    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    // 1일 앞의 빈칸 (일요일 시작 달력)
    const blanks = Array.from({ length: firstDay.getDay() }, () => {
      const blank = document.createElement('span');
      blank.className = 'day-blank';
      return blank;
    });
    const days = Array.from({ length: daysInMonth }, (_, i) =>
      createDayCell(new Date(year, month, i + 1)),
    );
    grid.replaceChildren(...headers, ...blanks, ...days);
  };

  const moveMonth = (delta: number): void => {
    const moved = new Date(year, month + delta, 1);
    year = moved.getFullYear();
    month = moved.getMonth();
    render();
  };
  previousButton.addEventListener('click', () => moveMonth(-1));
  nextButton.addEventListener('click', () => moveMonth(1));

  void Promise.all([window.api.getHolidays(), window.api.getSettings()]).then(
    ([holidayData, settings]) => {
      holidays = new Map(holidayData.holidays.map((holiday) => [holiday.date, holiday.name]));
      offDays = new Set(settings.offDays);
      render();
    },
  );
  render();
}
