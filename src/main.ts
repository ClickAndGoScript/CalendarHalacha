/// <reference path="../Otzaria otzaria plugins lib-plugins_sdk/otzaria_plugin.d.ts" />

// ═══════════════════════════════════════════════════════════════════════════
// Types & Interfaces
// ═══════════════════════════════════════════════════════════════════════════

interface HebrewDate {
  day: number;
  month: number;
  year: number;
  monthName: string;
}

interface CalendarDay {
  gregorian: Date;
  hebrew: HebrewDate;
  isToday: boolean;
  isSelected: boolean;
  isOtherMonth: boolean;
  isShabbat: boolean;
  holidays: string[];
}

type CalendarView = 'month' | 'week';

// ═══════════════════════════════════════════════════════════════════════════
// State
// ═══════════════════════════════════════════════════════════════════════════

let currentDate = new Date();
let selectedDate = new Date();
let currentView: CalendarView = 'month';
let theme: any = null;

// ═══════════════════════════════════════════════════════════════════════════
// Hebrew Calendar Utilities
// ═══════════════════════════════════════════════════════════════════════════

const HEBREW_MONTHS = [
  'ניסן', 'אייר', 'סיון', 'תמוז', 'אב', 'אלול',
  'תשרי', 'חשון', 'כסלו', 'טבת', 'שבט', 'אדר'
];

const GREGORIAN_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
];

function numberToHebrew(num: number): string {
  const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
  const tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
  const hundreds = ['', 'ק', 'ר', 'ש', 'ת'];
  
  if (num === 15) return 'טו';
  if (num === 16) return 'טז';
  
  let result = '';
  
  if (num >= 100) {
    result += hundreds[Math.floor(num / 100)];
    num %= 100;
  }
  
  if (num >= 10) {
    result += tens[Math.floor(num / 10)];
    num %= 10;
  }
  
  if (num > 0) {
    result += ones[num];
  }
  
  return result;
}

async function getHebrewDate(gregorianDate: Date): Promise<HebrewDate> {
  try {
    const response = await Otzaria.call('calendar.getJewishDate', {
      date: gregorianDate.toISOString()
    });
    
    if (response.success && response.data) {
      const data = response.data as any;
      return {
        day: data.day,
        month: data.month,
        year: data.year,
        monthName: HEBREW_MONTHS[(data.month - 1) % 12]
      };
    }
  } catch (error) {
    console.error('Failed to get Hebrew date:', error);
  }
  
  // Fallback: simple approximation
  const jewishEpoch = 347997;
  const gregorianEpoch = 1721426;
  const jdn = Math.floor(gregorianDate.getTime() / 86400000) + gregorianEpoch;
  const daysSinceEpoch = jdn - jewishEpoch;
  const approxYear = Math.floor(daysSinceEpoch / 365) + 1;
  
  return {
    day: gregorianDate.getDate(),
    month: ((gregorianDate.getMonth() + 6) % 12) + 1,
    year: approxYear + 3760,
    monthName: HEBREW_MONTHS[((gregorianDate.getMonth() + 6) % 12)]
  };
}

function formatHebrewYear(year: number): string {
  const thousands = Math.floor(year / 1000);
  const remainder = year % 1000;
  const remainderStr = numberToHebrew(remainder);
  
  if (remainderStr.length > 1) {
    return `ה׳${remainderStr.substring(0, remainderStr.length - 1)}״${remainderStr.substring(remainderStr.length - 1)}`;
  } else if (remainderStr.length === 1) {
    return `ה׳${remainderStr}׳`;
  }
  return remainderStr;
}

// ═══════════════════════════════════════════════════════════════════════════
// Calendar Generation
// ═══════════════════════════════════════════════════════════════════════════

async function generateCalendarDays(): Promise<CalendarDay[]> {
  const days: CalendarDay[] = [];
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  if (currentView === 'week') {
    // Week view: 7 days starting from Sunday
    const weekStart = new Date(selectedDate);
    weekStart.setDate(selectedDate.getDate() - selectedDate.getDay());
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      const hebrew = await getHebrewDate(date);
      
      days.push({
        gregorian: date,
        hebrew,
        isToday: isSameDay(date, new Date()),
        isSelected: isSameDay(date, selectedDate),
        isOtherMonth: false,
        isShabbat: date.getDay() === 6,
        holidays: []
      });
    }
  } else {
    // Month view
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startWeekday = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    
    // Previous month days
    if (startWeekday > 0) {
      const prevMonthLastDay = new Date(year, month, 0).getDate();
      for (let i = startWeekday - 1; i >= 0; i--) {
        const date = new Date(year, month - 1, prevMonthLastDay - i);
        const hebrew = await getHebrewDate(date);
        days.push({
          gregorian: date,
          hebrew,
          isToday: isSameDay(date, new Date()),
          isSelected: isSameDay(date, selectedDate),
          isOtherMonth: true,
          isShabbat: date.getDay() === 6,
          holidays: []
        });
      }
    }
    
    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const hebrew = await getHebrewDate(date);
      days.push({
        gregorian: date,
        hebrew,
        isToday: isSameDay(date, new Date()),
        isSelected: isSameDay(date, selectedDate),
        isOtherMonth: false,
        isShabbat: date.getDay() === 6,
        holidays: []
      });
    }
    
    // Next month days (fill to 42 cells)
    const remainingCells = 42 - days.length;
    for (let day = 1; day <= remainingCells; day++) {
      const date = new Date(year, month + 1, day);
      const hebrew = await getHebrewDate(date);
      days.push({
        gregorian: date,
        hebrew,
        isToday: isSameDay(date, new Date()),
        isSelected: isSameDay(date, selectedDate),
        isOtherMonth: true,
        isShabbat: date.getDay() === 6,
        holidays: []
      });
    }
  }
  
  return days;
}

function isSameDay(date1: Date, date2: Date): boolean {
  return date1.getDate() === date2.getDate() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getFullYear() === date2.getFullYear();
}

// ═══════════════════════════════════════════════════════════════════════════
// Rendering
// ═══════════════════════════════════════════════════════════════════════════

async function renderCalendar() {
  const grid = document.getElementById('calendar-grid');
  if (!grid) return;
  
  grid.className = `calendar-grid ${currentView}-view`;
  grid.innerHTML = '';
  
  const days = await generateCalendarDays();
  
  days.forEach(day => {
    const cell = createDayCell(day);
    grid.appendChild(cell);
  });
  
  updateMonthTitle();
}

function createDayCell(day: CalendarDay): HTMLElement {
  const cell = document.createElement('div');
  cell.className = 'day-cell';
  
  if (day.isOtherMonth) cell.classList.add('other-month');
  if (day.isSelected) cell.classList.add('selected');
  if (day.isToday) cell.classList.add('today');
  if (day.isShabbat) cell.classList.add('shabbat');
  
  // Apply theme colors
  if (theme) {
    const cs = theme.colorScheme;
    
    if (day.isShabbat || day.holidays.length > 0) {
      cell.style.backgroundColor = hexToRgba(cs.secondaryContainer, 0.4);
    } else if (day.isSelected) {
      cell.style.backgroundColor = cs.primaryContainer;
      cell.style.color = cs.onPrimaryContainer;
    } else if (day.isToday) {
      cell.style.backgroundColor = hexToRgba(cs.primary, 0.25);
      cell.style.borderColor = cs.primary;
    } else {
      cell.style.backgroundColor = cs.surface;
      cell.style.borderColor = cs.outlineVariant;
    }
    
    cell.style.border = `${day.isToday ? 2 : 1}px solid`;
  }
  
  // Header
  const header = document.createElement('div');
  header.className = 'day-header';
  
  const gregorianSpan = document.createElement('span');
  gregorianSpan.className = 'day-gregorian';
  gregorianSpan.textContent = day.gregorian.getDate().toString();
  if (theme && day.isSelected) {
    gregorianSpan.style.color = hexToRgba(theme.colorScheme.onPrimaryContainer, 0.85);
  } else if (theme) {
    gregorianSpan.style.color = theme.colorScheme.onSurfaceVariant;
  }
  
  const hebrewSpan = document.createElement('span');
  hebrewSpan.className = 'day-hebrew';
  hebrewSpan.textContent = numberToHebrew(day.hebrew.day);
  if (theme && day.isSelected) {
    hebrewSpan.style.color = theme.colorScheme.onPrimaryContainer;
  } else if (theme) {
    hebrewSpan.style.color = theme.colorScheme.onSurface;
  }
  
  header.appendChild(gregorianSpan);
  header.appendChild(hebrewSpan);
  cell.appendChild(header);
  
  // Extras (holidays, events)
  const extras = document.createElement('div');
  extras.className = 'day-extras';
  
  day.holidays.forEach(holiday => {
    const holidayEl = document.createElement('div');
    holidayEl.className = 'day-holiday';
    holidayEl.textContent = holiday;
    if (theme) {
      holidayEl.style.color = theme.colorScheme.onSurface;
    }
    extras.appendChild(holidayEl);
  });
  
  cell.appendChild(extras);
  
  // Click handler
  cell.addEventListener('click', () => {
    if (day.isOtherMonth) {
      currentDate = new Date(day.gregorian);
      selectedDate = new Date(day.gregorian);
    } else {
      selectedDate = new Date(day.gregorian);
    }
    renderCalendar();
  });
  
  return cell;
}

function updateMonthTitle() {
  const titleEl = document.getElementById('month-title');
  if (!titleEl) return;
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const gregName = GREGORIAN_MONTHS[month];
  
  getHebrewDate(currentDate).then(hebrew => {
    const hebYear = formatHebrewYear(hebrew.year);
    titleEl.textContent = `${hebrew.monthName} ${hebYear} • ${gregName} (${month + 1}) ${year}`;
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Theme
// ═══════════════════════════════════════════════════════════════════════════

function applyTheme(themeData: any) {
  theme = themeData;
  const cs = themeData.colorScheme;
  
  document.body.style.backgroundColor = cs.surface;
  document.body.style.color = cs.onSurface;
  
  // Top bar
  const topbar = document.querySelector('.calendar-topbar') as HTMLElement;
  if (topbar) {
    topbar.style.backgroundColor = cs.surfaceContainerHighest;
  }
  
  // Buttons
  document.querySelectorAll('.icon-button').forEach(btn => {
    const el = btn as HTMLElement;
    el.style.backgroundColor = cs.surfaceContainerHighest;
    el.style.color = cs.onSurface;
  });
  
  // Toggle buttons
  document.querySelectorAll('.toggle-button').forEach(btn => {
    const el = btn as HTMLElement;
    if (el.classList.contains('active')) {
      el.style.backgroundColor = cs.secondaryContainer;
      el.style.color = cs.onSecondaryContainer;
    } else {
      el.style.backgroundColor = 'transparent';
      el.style.color = cs.onSurface;
    }
  });
  
  // Day names
  document.querySelectorAll('.day-name').forEach(name => {
    const el = name as HTMLElement;
    el.style.color = cs.onSurfaceVariant;
  });
  
  // Title
  const title = document.getElementById('month-title');
  if (title) {
    title.style.color = cs.onSurface;
  }
  
  renderCalendar();
}

function hexToRgba(hex: string, alpha: number): string {
  // Remove # if present
  hex = hex.replace('#', '');
  
  // Parse hex
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Event Handlers
// ═══════════════════════════════════════════════════════════════════════════

function setupEventListeners() {
  // Today button
  document.getElementById('btn-today')?.addEventListener('click', () => {
    currentDate = new Date();
    selectedDate = new Date();
    renderCalendar();
  });
  
  // Previous month
  document.getElementById('btn-prev')?.addEventListener('click', () => {
    if (currentView === 'month') {
      currentDate.setMonth(currentDate.getMonth() - 1);
    } else {
      currentDate.setDate(currentDate.getDate() - 7);
      selectedDate.setDate(selectedDate.getDate() - 7);
    }
    renderCalendar();
  });
  
  // Next month
  document.getElementById('btn-next')?.addEventListener('click', () => {
    if (currentView === 'month') {
      currentDate.setMonth(currentDate.getMonth() + 1);
    } else {
      currentDate.setDate(currentDate.getDate() + 7);
      selectedDate.setDate(selectedDate.getDate() + 7);
    }
    renderCalendar();
  });
  
  // View toggle
  document.querySelectorAll('.toggle-button').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLElement;
      const view = target.dataset.view as CalendarView;
      
      if (view !== currentView) {
        currentView = view;
        
        // Update active state
        document.querySelectorAll('.toggle-button').forEach(b => {
          b.classList.remove('active');
        });
        target.classList.add('active');
        
        // Re-apply theme to buttons
        if (theme) {
          document.querySelectorAll('.toggle-button').forEach(btn => {
            const el = btn as HTMLElement;
            if (el.classList.contains('active')) {
              el.style.backgroundColor = theme.colorScheme.secondaryContainer;
              el.style.color = theme.colorScheme.onSecondaryContainer;
            } else {
              el.style.backgroundColor = 'transparent';
              el.style.color = theme.colorScheme.onSurface;
            }
          });
        }
        
        renderCalendar();
      }
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Initialization
// ═══════════════════════════════════════════════════════════════════════════

Otzaria.on('plugin.boot', (bootData) => {
  console.log('Calendar plugin booted:', bootData);
  applyTheme(bootData.theme);
  setupEventListeners();
  renderCalendar();
});

Otzaria.on('theme.changed', (themeData) => {
  console.log('Theme changed:', themeData);
  applyTheme(themeData);
});

Otzaria.on('plugin.ready', () => {
  console.log('Calendar plugin ready');
});
