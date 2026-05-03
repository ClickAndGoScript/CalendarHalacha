/**
 * פונקציות עזר נטולות-DOM לשכבת המעקב.
 *
 * עיקרון: כל הפעולות כאן מחשבות על `HebrewDate` בלבד (מודל זמן עברי).
 * המרה לתאריך גרגוריאני נעשית רק כשנדרשת תצוגה — `gregorianDateKey`
 * שנשמר על אירוע הוא תוצאת המרה חד-פעמית בזמן יצירת האירוע.
 */

import {
  addDaysHebrew,
  dateToHebrew,
  getHebrewMonthName,
  hebrewDaysInMonth,
  hebrewToDate,
  isHebrewLeapYear,
  nextHebrewMonth,
} from '../../shared/hebrew-calendar.js';
import type { HebrewDate, Onah, AddOnahsResult } from './tracking-types.js';

/** מרחיב `{day, month, year}` שהתקבל מ-shared למבנה `HebrewDate` מלא. */
export function hydrateHebrewDate(d: { day: number; month: number; year: number }): HebrewDate {
  const isLeapYear = isHebrewLeapYear(d.year);
  return {
    day: d.day,
    month: d.month,
    year: d.year,
    monthName: getHebrewMonthName(d.month, isLeapYear),
    isLeapYear,
  };
}

/** ממיר Date ל-HebrewDate בסיסי, ללא נתוני חגים/שבת. */
export function gregToHebrewDate(date: Date): HebrewDate {
  const base = dateToHebrew(date);
  return {
    day: base.day,
    month: base.month,
    year: base.year,
    monthName: base.monthName,
    isLeapYear: base.isLeapYear,
  };
}

/**
 * מחזיר את התאריך הגרגוריאני (YYYY-MM-DD) לתאריך עברי. משמש כ-`gregorianDateKey`.
 *
 * חשוב: `onah: 'night'` שייך לתאריך העברי שמתחיל בערב הזה. הלילה ההלכתי
 * מתחיל בשקיעת היום הגרגוריאני **שלפני** היום הגרגוריאני שמתאים לתאריך
 * העברי. כאן אנו מחזירים את התאריך הגרגוריאני המתאים ליום העברי עצמו —
 * שכבת התצוגה אחראית להבחין בין יום ולילה לצרכי תזכורת.
 */
export function hebrewToGregKey(d: HebrewDate): string {
  const greg = hebrewToDate(d.year, d.month, d.day);
  if (!greg) {
    throw new Error(`hebrewToGregKey: invalid hebrew date ${d.year}-${d.month}-${d.day}`);
  }
  return [
    greg.getFullYear(),
    String(greg.getMonth() + 1).padStart(2, '0'),
    String(greg.getDate()).padStart(2, '0'),
  ].join('-');
}

/** האם שני תאריכים עבריים שווים. */
export function sameHebrewDate(a: HebrewDate, b: HebrewDate): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

/**
 * מוסיף `n` עונות (חצאי יממה) לתאריך + onah נתונים.
 * סדר העונות: ...night(d) → day(d) → night(d+1) → day(d+1)...
 * (היממה ההלכתית מתחילה בשקיעה — לכן night קודם ל-day של אותו יום עברי.)
 */
export function addOnahs(date: HebrewDate, onah: Onah, n: number): AddOnahsResult {
  // ממירים ל"מספר עונות מאז epoch" — נוח לחשבון.
  const epoch = hebrewToDate(date.year, date.month, date.day);
  if (!epoch) throw new Error('addOnahs: invalid hebrew date');
  const dayIndex = Math.floor(epoch.getTime() / 86400000);
  // night=0, day=1 (night קודם)
  const onahIndex = dayIndex * 2 + (onah === 'night' ? 0 : 1) + n;
  const newDayIndex = Math.floor(onahIndex / 2);
  const newOnah: Onah = onahIndex % 2 === 0 ? 'night' : 'day';
  const newDate = new Date(newDayIndex * 86400000);
  return { date: gregToHebrewDate(newDate), onah: newOnah };
}

/**
 * מספר ימים inclusive בין שני תאריכים עבריים. דוגמה: א'→ג' = 3.
 */
export function daysBetweenInclusive(from: HebrewDate, to: HebrewDate): number {
  const a = hebrewToDate(from.year, from.month, from.day);
  const b = hebrewToDate(to.year, to.month, to.day);
  if (!a || !b) throw new Error('daysBetweenInclusive: invalid hebrew date');
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
}

/**
 * מוסיף N ימים גרגוריאניים אך מחזיר HebrewDate. שימושי עבור ספירות
 * inclusive (countFrom=1 → להוסיף N-1 ימים).
 */
export function addDaysToHebrew(date: HebrewDate, days: number): HebrewDate {
  const shifted = addDaysHebrew({ year: date.year, month: date.month, day: date.day }, days);
  return hydrateHebrewDate(shifted);
}

/**
 * עונת החודש (`shift_by_hebrew_month_same_day`).
 *
 * מטרה: להעביר תאריך לאותו יום-בחודש בחודש העברי הבא, עם טיפול בחודש חסר
 * (סעיף 24.2 ב-tracking-ui-plan).
 *
 * - אם היום קיים בחודש היעד: מחזיר אותו.
 * - אם לא קיים (למשל ל' שלא קיים בחודש בן 29):
 *   - `next_month_first_day`: עובר ל-א' של החודש שאחרי (=ר"ח השני).
 *   - `previous_existing_day`: היום האחרון הקיים בחודש היעד.
 *   - `skip`: מחזיר null.
 */
export function shiftByHebrewMonth(
  source: HebrewDate,
  monthsForward: number,
  fallback: 'next_month_first_day' | 'previous_existing_day' | 'skip',
): { target: HebrewDate | null; warning?: string } {
  let { year, month } = source;
  for (let i = 0; i < monthsForward; i++) {
    const next = nextHebrewMonth(year, month);
    year = next.year;
    month = next.month;
  }
  const monthLen = hebrewDaysInMonth(month, year);
  if (source.day <= monthLen) {
    return { target: hydrateHebrewDate({ day: source.day, month, year }) };
  }
  // היום לא קיים בחודש היעד.
  if (fallback === 'skip') {
    return {
      target: null,
      warning: `יום ${source.day} לא קיים בחודש ${getHebrewMonthName(month, isHebrewLeapYear(year))}`,
    };
  }
  if (fallback === 'previous_existing_day') {
    return {
      target: hydrateHebrewDate({ day: monthLen, month, year }),
      warning: `יום ${source.day} לא קיים — נבחר היום האחרון של החודש (${monthLen})`,
    };
  }
  // next_month_first_day
  const after = nextHebrewMonth(year, month);
  return {
    target: hydrateHebrewDate({ day: 1, month: after.month, year: after.year }),
    warning: `יום ${source.day} לא קיים בחודש היעד — הועבר ל-א' בחודש שאחריו`,
  };
}

/** יום השבוע (0..6) של תאריך עברי. */
export function hebrewWeekday(d: HebrewDate): number {
  const greg = hebrewToDate(d.year, d.month, d.day);
  if (!greg) throw new Error('hebrewWeekday: invalid hebrew date');
  return greg.getDay();
}

/** יוצר UUID. תלוי ב-`crypto.randomUUID` הזמין ב-WebView. */
export function newId(): string {
  return crypto.randomUUID();
}

/** ISO timestamp נוכחי. */
export function nowIso(): string {
  return new Date().toISOString();
}
