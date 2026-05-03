/**
 * אנימציות לשכבת המעקב (סעיף 12).
 *
 * עיקרון: אנימציות הן חלק מההסבר למשתמש, לא קישוט. כל אחת ניתנת לעצירה
 * ע"י החזרת `cancel()`. מכבדות `prefers-reduced-motion` — באותו מצב הן
 * קופצות ישירות לתוצאה.
 *
 * הפונקציות כאן עובדות מול ה-DOM של הלוח הקיים: הן מאתרות תאים ע"י
 * `data-tracking-mounted` + תאריך עברי שנקרא מ-`<day-tracking-layer>`.
 */

import type { HebrewDate } from './tracking-types.js';

const REDUCED_MOTION =
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

/** מאתר תא לפי תאריך עברי דרך השכבה המוטמעת (`<day-tracking-layer>`). */
export function findCellByHebrewDate(
  d: Pick<HebrewDate, 'year' | 'month' | 'day'>,
): HTMLElement | null {
  const layer = document.querySelector<HTMLElement>(
    `day-tracking-layer[year="${d.year}"][month="${d.month}"][day="${d.day}"]`,
  );
  if (!layer) return null;
  return (layer.parentElement as HTMLElement) ?? null;
}

/** גלילה חלקה לתא, עם עצירה של 180ms בסוף. סעיף 12.1.2. */
export async function scrollCellIntoView(cell: HTMLElement): Promise<void> {
  cell.scrollIntoView({
    behavior: REDUCED_MOTION ? 'auto' : 'smooth',
    block: 'center',
    inline: 'center',
  });
  if (!REDUCED_MOTION) {
    await wait(280);
  }
  await wait(180);
}

/** הבהוב/highlight של תא ע"י הוספת class זמני. הקומפוננטה מציגה focus-ring כש-`isTarget`. */
export function pulseCell(cell: HTMLElement, durationMs = 5400): () => void {
  cell.classList.add('tracking-pulse');
  const t = setTimeout(() => cell.classList.remove('tracking-pulse'), durationMs);
  return () => {
    clearTimeout(t);
    cell.classList.remove('tracking-pulse');
  };
}

export interface CountAnimationOptions {
  /** רצף תאריכים בסדר עולה. הראשון יקבל "1", השני "2" וכו'. */
  sequence: HebrewDate[];
  /** מילישניות בין יום ליום (ברירת מחדל 45ms, סעיף 12.1.4). */
  stepMs?: number;
  /** קולבק לכל יום — לרענון UI מסונכרן. */
  onStep?: (index: number, date: HebrewDate) => void;
}

/**
 * אנימציית ספירה: כותב מספר על תאים ברצף. ב-reduced motion קופץ למצב
 * הסופי בבת אחת. מחזיר `cancel()` לעצירה.
 */
export function runCountAnimation(opts: CountAnimationOptions): {
  done: Promise<void>;
  cancel: () => void;
} {
  let cancelled = false;
  const stepMs = opts.stepMs ?? 45;

  const done = (async () => {
    if (REDUCED_MOTION) {
      // קפיצה ישירה: רק היעד האחרון מקבל מספר.
      const last = opts.sequence[opts.sequence.length - 1];
      if (last) {
        setCellCountLabel(last, String(opts.sequence.length));
        opts.onStep?.(opts.sequence.length - 1, last);
      }
      return;
    }
    for (let i = 0; i < opts.sequence.length; i++) {
      if (cancelled) return;
      const date = opts.sequence[i]!;
      setCellCountLabel(date, String(i + 1));
      opts.onStep?.(i, date);
      await wait(stepMs);
    }
  })();

  return {
    done,
    cancel: () => {
      cancelled = true;
      clearAllCountLabels();
    },
  };
}

/** מנקה את כל ה-count labels בלוח. */
export function clearAllCountLabels(): void {
  document.querySelectorAll<HTMLElement>('day-tracking-layer').forEach((el) => {
    (el as HTMLElement & { countLabel?: string | null }).countLabel = null;
  });
}

function setCellCountLabel(date: HebrewDate, label: string): void {
  const layer = document.querySelector<HTMLElement>(
    `day-tracking-layer[year="${date.year}"][month="${date.month}"][day="${date.day}"]`,
  ) as (HTMLElement & { countLabel?: string | null }) | null;
  if (layer) layer.countLabel = label;
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
