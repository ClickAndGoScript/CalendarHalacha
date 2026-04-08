/// <reference path="../Otzaria otzaria plugins lib-plugins_sdk/otzaria_plugin.d.ts" />

type CalendarView = 'month' | 'week';

interface HebrewDate {
  day: number;
  month: number;
  year: number;
  monthName: string;
  isLeapYear: boolean;
  isShabbat: boolean;
  holidays: HolidayLabel[];
}

interface HolidayLabel {
  text: string;
  kind: 'yomTov' | 'roshChodesh' | 'taanit' | 'special';
}

interface CalendarCellData {
  date: Date;
  hebrew: HebrewDate;
  labels: HolidayLabel[];
  isToday: boolean;
  isSelected: boolean;
  isOutsidePrimaryRange: boolean;
  isShabbat: boolean;
}

interface ThemeColors {
  primary: string;
  onPrimary?: string;
  primaryContainer?: string;
  onPrimaryContainer?: string;
  secondary?: string;
  onSecondary?: string;
  secondaryContainer?: string;
  onSecondaryContainer?: string;
  tertiary?: string;
  onTertiary?: string;
  surface: string;
  onSurface: string;
  surfaceContainer?: string;
  surfaceContainerLow?: string;
  surfaceContainerHighest?: string;
  onSurfaceVariant?: string;
  outline?: string;
  outlineVariant?: string;
}

interface ThemeData {
  mode: 'light' | 'dark';
  colorScheme: ThemeColors;
}

interface AppState {
  view: CalendarView;
  selectedDate: Date;
  anchorDate: Date;
  theme: ThemeData | null;
}

const state: AppState = {
  view: 'month',
  selectedDate: stripTime(new Date()),
  anchorDate: startOfMonth(new Date()),
  theme: null,
};

const HEBREW_DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const HEBREW_MONTH_NAMES = [
  'ניסן',
  'אייר',
  'סיון',
  'תמוז',
  'אב',
  'אלול',
  'תשרי',
  'חשון',
  'כסלו',
  'טבת',
  'שבט',
  'אדר',
];

const GREGORIAN_MONTH_FORMATTER = new Intl.DateTimeFormat('he', { month: 'long' });

const hebrewDateCache = new Map<string, Promise<HebrewDate>>();
let renderSequence = 0;
let shellRendered = false;
let listenersAttached = false;
let initStarted = false;

function stripTime(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
}

function addMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function startOfWeek(date: Date): Date {
  return addDays(stripTime(date), -stripTime(date).getDay());
}

function isSameDay(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate();
}

function toDateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function toHebrewNumber(value: number): string {
  if (value <= 0) return '';

  const units = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
  const tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
  const hundreds = ['', 'ק', 'ר', 'ש', 'ת'];

  if (value === 15) return 'טו';
  if (value === 16) return 'טז';

  let remaining = value;
  let output = '';

  while (remaining >= 400) {
    output += 'ת';
    remaining -= 400;
  }

  if (remaining >= 100) {
    output += hundreds[Math.floor(remaining / 100)];
    remaining %= 100;
  }

  if (remaining >= 10) {
    output += tens[Math.floor(remaining / 10)];
    remaining %= 10;
  }

  if (remaining > 0) {
    output += units[remaining];
  }

  return output;
}

function formatHebrewYear(year: number): string {
  const reduced = year % 1000;
  const text = toHebrewNumber(reduced);

  if (!text) return String(year);
  if (text.length === 1) return `ה׳${text}׳`;

  return `ה׳${text.slice(0, -1)}״${text.slice(-1)}`;
}

function formatSelectedTitle(date: Date, hebrew: HebrewDate): string {
  const gregorianMonth = GREGORIAN_MONTH_FORMATTER.format(date);
  const hebrewYear = formatHebrewYear(hebrew.year);
  return `${toHebrewNumber(hebrew.day)} ${hebrew.monthName} ${hebrewYear} • ${date.getDate()} ${gregorianMonth} ${date.getFullYear()}`;
}

function getThemeColor(name: keyof ThemeColors, fallback: string): string {
  return state.theme?.colorScheme[name] ?? fallback;
}

function hexToRgba(hex: string, alpha: number): string {
  const sanitized = hex.replace('#', '');
  if (sanitized.length !== 6) return hex;

  const r = parseInt(sanitized.slice(0, 2), 16);
  const g = parseInt(sanitized.slice(2, 4), 16);
  const b = parseInt(sanitized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function applyTheme(theme: ThemeData): void {
  state.theme = theme;

  const root = document.documentElement;
  const surface = theme.colorScheme.surface;
  const onSurface = theme.colorScheme.onSurface;
  const primary = getThemeColor('primary', '#8b6a11');
  const primaryContainer = getThemeColor('primaryContainer', hexToRgba(primary, 0.14));
  const secondaryContainer = getThemeColor('secondaryContainer', '#f3e1bd');
  const surfaceContainer = getThemeColor('surfaceContainer', hexToRgba(onSurface, 0.04));
  const surfaceContainerHighest = getThemeColor('surfaceContainerHighest', hexToRgba(onSurface, 0.08));
  const outline = getThemeColor('outline', hexToRgba(onSurface, 0.24));
  const outlineVariant = getThemeColor('outlineVariant', hexToRgba(onSurface, 0.16));
  const onSurfaceVariant = getThemeColor('onSurfaceVariant', hexToRgba(onSurface, 0.74));
  const onPrimaryContainer = getThemeColor('onPrimaryContainer', onSurface);
  const onSecondaryContainer = getThemeColor('onSecondaryContainer', onSurface);

  root.style.setProperty('--surface', surface);
  root.style.setProperty('--on-surface', onSurface);
  root.style.setProperty('--on-surface-variant', onSurfaceVariant);
  root.style.setProperty('--primary', primary);
  root.style.setProperty('--primary-container', primaryContainer);
  root.style.setProperty('--on-primary-container', onPrimaryContainer);
  root.style.setProperty('--on-primary-container-muted', hexToRgba(onPrimaryContainer, 0.78));
  root.style.setProperty('--secondary-container', secondaryContainer);
  root.style.setProperty('--on-secondary-container', onSecondaryContainer);
  root.style.setProperty('--surface-container', surfaceContainer);
  root.style.setProperty('--surface-container-highest', surfaceContainerHighest);
  root.style.setProperty('--outline', outline);
  root.style.setProperty('--outline-variant', outlineVariant);
  root.style.setProperty('--today-fill', hexToRgba(primary, theme.mode === 'dark' ? 0.26 : 0.16));
  root.style.setProperty('--special-fill', hexToRgba(secondaryContainer, theme.mode === 'dark' ? 0.34 : 0.5));
  root.style.setProperty('--shadow', theme.mode === 'dark'
    ? '0 10px 30px rgba(0, 0, 0, 0.32)'
    : '0 8px 24px rgba(93, 70, 27, 0.10)');

  document.body.style.background = surface;
  document.body.style.color = onSurface;
}

async function getSelectedDateFromHost(): Promise<Date | null> {
  try {
    const response = await Otzaria.call<{ date?: string }>('calendar.getSelectedDate');
    const dateValue = response.success ? response.data?.date : undefined;

    if (!dateValue) return null;

    const date = stripTime(new Date(dateValue));
    return Number.isNaN(date.getTime()) ? null : date;
  } catch (error) {
    console.error('calendar.getSelectedDate failed', error);
    return null;
  }
}

async function getHebrewDate(date: Date): Promise<HebrewDate> {
  const key = toDateKey(date);
  const cached = hebrewDateCache.get(key);
  if (cached) return cached;

  const request = (async () => {
    try {
      const response = await Otzaria.call<{
        year: number;
        month: number;
        day: number;
        isLeapYear?: boolean;
        monthName?: string;
        isShabbat?: boolean;
        holidays?: HolidayLabel[];
      }>('calendar.getJewishDate', { date: toDateKey(date) });

      if (response.success && response.data) {
        const month = response.data.month;
        const isLeapYear = Boolean(response.data.isLeapYear);

        return {
          day: response.data.day,
          month,
          year: response.data.year,
          monthName: response.data.monthName ?? getHebrewMonthName(month, isLeapYear),
          isLeapYear,
          isShabbat: Boolean(response.data.isShabbat),
          holidays: response.data.holidays ?? [],
        };
      }
    } catch (error) {
      console.error('calendar.getJewishDate failed', error);
    }

    // מחיקה מה-cache כדי שהקריאה הבאה תנסה שוב (כשה-SDK יהיה מוכן)
    hebrewDateCache.delete(key);
    return fallbackHebrewDate(date);
  })();

  hebrewDateCache.set(key, request);
  return request;
}

function getHebrewMonthName(month: number, isLeapYear: boolean): string {
  if (isLeapYear && month === 12) return 'אדר א׳';
  if (isLeapYear && month === 13) return 'אדר ב׳';
  return HEBREW_MONTH_NAMES[(month - 1) % HEBREW_MONTH_NAMES.length] ?? '';
}

function fallbackHebrewDate(date: Date): HebrewDate {
  return {
    day: date.getDate(),
    month: ((date.getMonth() + 6) % 12) + 1,
    year: date.getFullYear() + 3760,
    monthName: HEBREW_MONTH_NAMES[(date.getMonth() + 6) % 12],
    isLeapYear: false,
    isShabbat: date.getDay() === 6,
    holidays: [],
  };
}

function buildVisibleDates(): Date[] {
  if (state.view === 'week') {
    const weekStart = startOfWeek(state.selectedDate);
    return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  }

  const monthStart = startOfMonth(state.anchorDate);
  const gridStart = addDays(monthStart, -monthStart.getDay());
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

async function buildCalendarCells(): Promise<CalendarCellData[]> {
  const visibleDates = buildVisibleDates();
  const primaryMonth = state.anchorDate.getMonth();
  const today = stripTime(new Date());

  const hebrewDates = await Promise.all(visibleDates.map((date) => getHebrewDate(date)));

  return visibleDates.map((date, index) => ({
    date,
    hebrew: hebrewDates[index],
    labels: hebrewDates[index].holidays.slice(0, 2),
    isToday: isSameDay(date, today),
    isSelected: isSameDay(date, state.selectedDate),
    isOutsidePrimaryRange: state.view === 'month' ? date.getMonth() !== primaryMonth : false,
    isShabbat: hebrewDates[index].isShabbat,
  }));
}

function renderShell(): void {
  if (shellRendered) return;

  const app = document.getElementById('app');
  if (!app) return;

  app.innerHTML = `
    <section class="calendar-shell">
      <header class="calendar-toolbar">
        <div class="toolbar-side toolbar-side-start">
          <button class="icon-button" id="nav-next" type="button" aria-label="הבא">
            <span class="material-icons">chevron_left</span>
          </button>
          <div class="toolbar-title-wrap">
            <h1 class="toolbar-title" id="calendar-title">טוען…</h1>
          </div>
          <button class="icon-button" id="nav-prev" type="button" aria-label="הקודם">
            <span class="material-icons">chevron_right</span>
          </button>
        </div>

        <div class="toolbar-actions">
          <button class="icon-button subtle-button" id="jump-today" type="button" aria-label="היום">
            <span class="material-icons">today</span>
          </button>
          <button class="pill-button is-active" id="today-button" type="button">היום</button>
        </div>

        <div class="toolbar-side toolbar-side-end">
          <div class="view-switch" role="tablist" aria-label="תצוגת לוח">
            <button class="view-button" id="view-week" data-view="week" type="button" role="tab" aria-selected="false">שבוע</button>
            <button class="view-button" id="view-month" data-view="month" type="button" role="tab" aria-selected="true">חודש</button>
          </div>
        </div>
      </header>

      <div class="weekday-row" id="weekday-row"></div>
      <div class="calendar-grid" id="calendar-grid" aria-live="polite"></div>
    </section>
  `;
  shellRendered = true;

  const weekdayRow = document.getElementById('weekday-row');
  if (weekdayRow) {
    weekdayRow.innerHTML = HEBREW_DAY_NAMES
      .map((dayName) => `<div class="weekday-cell">${dayName}</div>`)
      .join('');
  }

  attachShellListeners();
}

function attachShellListeners(): void {
  if (listenersAttached) return;

  document.getElementById('nav-prev')?.addEventListener('click', () => movePeriod(-1));
  document.getElementById('nav-next')?.addEventListener('click', () => movePeriod(1));
  document.getElementById('today-button')?.addEventListener('click', jumpToToday);
  document.getElementById('jump-today')?.addEventListener('click', jumpToToday);

  document.querySelectorAll<HTMLButtonElement>('.view-button').forEach((button) => {
    button.addEventListener('click', () => {
      const nextView = button.dataset.view as CalendarView;
      if (nextView === state.view) return;

      state.view = nextView;
      if (nextView === 'month') {
        state.anchorDate = startOfMonth(state.selectedDate);
      }
      void renderCalendar();
    });
  });

  listenersAttached = true;
}

function movePeriod(direction: 1 | -1): void {
  if (state.view === 'month') {
    state.anchorDate = addMonths(state.anchorDate, direction);
  } else {
    const nextSelected = addDays(state.selectedDate, direction * 7);
    state.selectedDate = nextSelected;
    state.anchorDate = startOfMonth(nextSelected);
  }

  renderCalendar();
}

function jumpToToday(): void {
  const today = stripTime(new Date());
  state.selectedDate = today;
  state.anchorDate = startOfMonth(today);
  renderCalendar();
}

function updateToolbarSelection(): void {
  document.querySelectorAll<HTMLButtonElement>('.view-button').forEach((button) => {
    const active = button.dataset.view === state.view;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', String(active));
  });
}

function updateTitle(text: string): void {
  const title = document.getElementById('calendar-title');
  if (title) {
    title.textContent = text;
  }
}

function createDayCell(cell: CalendarCellData): HTMLElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'calendar-cell';

  if (cell.isOutsidePrimaryRange) button.classList.add('is-outside');
  if (cell.isSelected) button.classList.add('is-selected');
  if (cell.isToday) button.classList.add('is-today');
  if (cell.labels.length > 0 || cell.isShabbat) button.classList.add('is-special');

  button.innerHTML = `
    <div class="cell-corner cell-corner-hebrew">
      <span class="cell-hebrew-day">${toHebrewNumber(cell.hebrew.day)}</span>
      ${cell.hebrew.day === 1 ? `<span class="cell-month-name">${cell.hebrew.monthName}</span>` : ''}
    </div>
    <div class="cell-corner cell-corner-gregorian">${cell.date.getDate()}</div>
    <div class="cell-body">
      ${cell.labels.map((label) => `<div class="cell-label cell-label-${label.kind}">${label.text}</div>`).join('')}
    </div>
  `;

  button.addEventListener('click', () => {
    state.selectedDate = stripTime(cell.date);
    state.anchorDate = startOfMonth(cell.date);
    renderCalendar();
  });

  return button;
}

async function renderCalendar(): Promise<void> {
  const currentRender = ++renderSequence;
  updateToolbarSelection();

  const grid = document.getElementById('calendar-grid');
  if (!grid) return;

  grid.className = `calendar-grid calendar-grid-${state.view}`;
  grid.innerHTML = '<div class="calendar-loading">טוען לוח…</div>';

  const selectedHebrew = await getHebrewDate(state.selectedDate);
  if (currentRender !== renderSequence) return;
  updateTitle(formatSelectedTitle(state.selectedDate, selectedHebrew));

  const cells = await buildCalendarCells();
  if (currentRender !== renderSequence) return;

  grid.innerHTML = '';
  cells.forEach((cell) => {
    grid.appendChild(createDayCell(cell));
  });
}

async function initializeState(): Promise<void> {
  const hostDate = await getSelectedDateFromHost();
  if (hostDate) {
    state.selectedDate = hostDate;
    state.anchorDate = startOfMonth(hostDate);
  }
}

async function tryLoadThemeFromHost(): Promise<void> {
  try {
    const response = await Otzaria.call<ThemeData>('app.getTheme');
    if (response.success && response.data) {
      applyTheme(response.data);
      return;
    }
  } catch (error) {
    console.error('app.getTheme failed', error);
  }

  if (!state.theme) {
    applyTheme({
      mode: 'light',
      colorScheme: {
        primary: '#9b6f12',
        surface: '#fcf8f1',
        onSurface: '#302417',
        primaryContainer: '#edd8aa',
        onPrimaryContainer: '#392600',
        secondaryContainer: '#f5e5c8',
        onSecondaryContainer: '#382d18',
        surfaceContainer: '#f7efe2',
        surfaceContainerHighest: '#efe3cf',
        outline: '#8d7a63',
        outlineVariant: '#d8c7af',
        onSurfaceVariant: '#6f5e49',
      },
    });
  }
}

async function initializeApp(bootTheme?: ThemeData): Promise<void> {
  if (initStarted) {
    if (bootTheme) {
      applyTheme(bootTheme);
      await initializeState();
      await renderCalendar();
    }
    return;
  }

  initStarted = true;
  renderShell();

  if (bootTheme) {
    applyTheme(bootTheme);
  } else {
    await tryLoadThemeFromHost();
  }

  await initializeState();
  await renderCalendar();
}

document.addEventListener('DOMContentLoaded', () => {
  // רק ציור ה-shell — ה-API נקרא רק אחרי plugin.boot כשה-SDK מוכן
  renderShell();
});

Otzaria.on('plugin.boot', async (bootData: { theme: ThemeData }) => {
  await initializeApp(bootData.theme);
});

Otzaria.on('theme.changed', (themeData: ThemeData) => {
  applyTheme(themeData);
  void renderCalendar();
});

Otzaria.on('calendar.date_changed', (payload: { date: string }) => {
  const nextDate = stripTime(new Date(payload.date));
  if (Number.isNaN(nextDate.getTime())) return;

  state.selectedDate = nextDate;
  if (state.view === 'month') {
    state.anchorDate = startOfMonth(nextDate);
  }
  void renderCalendar();
});
