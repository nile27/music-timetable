// 쉬는 날 달력 (S-02, Figma 7:2 오른쪽). 주말·공휴일은 누를 수 없고, 평일을 누르면 쉬는 날 지정/해제.
import { isWeekend } from '../shared/day-rules';
import { toDateKey } from '../shared/time';
import { el } from './dom';
import { createIcon } from './icons';
import { MESSAGES } from './messages';

export function setupOffDayCalendar(container: HTMLElement): void {
  const monthLabel = el('span', 'cal-month');
  const previousButton = el('button', 'cal-nav-btn', createIcon('chevronLeft'));
  const nextButton = el('button', 'cal-nav-btn', createIcon('chevronRight'));
  previousButton.type = 'button';
  nextButton.type = 'button';
  previousButton.setAttribute('aria-label', MESSAGES.previousMonth);
  nextButton.setAttribute('aria-label', MESSAGES.nextMonth);
  const grid = el('div', 'cal-grid');

  const weekdays = MESSAGES.weekdays.map((name, day) =>
    el('span', `cal-weekday${day === 0 || day === 6 ? ' is-weekend' : ''}`, name),
  );
  const legend = (swatch: string, label: string): HTMLElement =>
    el('span', 'cal-legend-item', el('span', `cal-legend-swatch ${swatch}`), label);

  container.append(
    el(
      'section',
      'calendar',
      el('h2', 'section-title', MESSAGES.offDayTitle),
      el('p', 'cal-help', MESSAGES.offDayHint),
      el('div', 'cal-header', previousButton, monthLabel, nextButton),
      el('div', 'cal-weekdays', ...weekdays),
      grid,
      el(
        'div',
        'cal-legend',
        legend('is-weekend', MESSAGES.legendWeekend),
        legend('is-holiday', MESSAGES.legendHoliday),
        legend('is-off', MESSAGES.legendOffDay),
        legend('is-today', MESSAGES.legendToday),
      ),
    ),
  );

  const today = new Date();
  let year = today.getFullYear();
  let month = today.getMonth(); // 0~11
  let holidays = new Map<string, string>();
  let offDays = new Set<string>();

  const createDayCell = (date: Date): HTMLButtonElement => {
    const dateKey = toDateKey(date);
    const holidayName = holidays.get(dateKey);
    const weekend = isWeekend(date);
    const isOff = offDays.has(dateKey);

    const cell = el('button', 'cal-day');
    cell.type = 'button';
    cell.classList.toggle('is-weekend', weekend);
    cell.classList.toggle('is-holiday', holidayName !== undefined);
    cell.classList.toggle('is-off', isOff);
    cell.classList.toggle('is-today', dateKey === toDateKey(today));
    // 주말·공휴일은 원래 쉬므로 바꿀 수 없다.
    cell.disabled = weekend || holidayName !== undefined;
    cell.setAttribute('aria-pressed', String(isOff));

    const note = holidayName ?? (isOff ? MESSAGES.offDayMark : weekend ? MESSAGES.weekendMark : '');
    cell.setAttribute('aria-label', MESSAGES.dayLabel(month + 1, date.getDate(), note));
    const label = holidayName
      ? MESSAGES.holidayShortLabel(holidayName)
      : isOff
        ? MESSAGES.offDayMark
        : '';
    cell.append(
      el('span', 'cal-day-num', String(date.getDate())),
      el('span', 'cal-day-label', label),
    );

    if (!cell.disabled) {
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
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    // 1일 앞의 빈칸: 디자인처럼 자리만 두고 그리지 않는다.
    const blanks = Array.from({ length: firstDay.getDay() }, () => {
      const blank = el('span', 'cal-day is-outside');
      blank.setAttribute('aria-hidden', 'true');
      return blank;
    });
    const days = Array.from({ length: daysInMonth }, (_, i) =>
      createDayCell(new Date(year, month, i + 1)),
    );
    grid.replaceChildren(...blanks, ...days);
  };

  const moveMonth = (delta: number): void => {
    const moved = new Date(year, month + delta, 1);
    year = moved.getFullYear();
    month = moved.getMonth();
    render();
  };
  previousButton.addEventListener('click', () => moveMonth(-1));
  nextButton.addEventListener('click', () => moveMonth(1));

  render();
  void Promise.all([window.api.getHolidays(), window.api.getSettings()]).then(
    ([holidayData, settings]) => {
      holidays = new Map(holidayData.holidays.map((holiday) => [holiday.date, holiday.name]));
      offDays = new Set(settings.offDays);
      render();
    },
  );
}
