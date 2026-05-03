/**
 * הזרקת שכבת ה-tracking (`<day-tracking-layer>`) על תאי הלוח הקיימים.
 *
 * ה-renderer הזה לא משכתב את ה-DOM של הלוח — הוא רק מצרף ל-`.calendar-cell`
 * את ה-Lit component שלנו. כך אנחנו לא נוגעים ב-`createDayCell` של `main.ts`
 * (סעיף 8 ב-tracking-ui-plan: "הקוד הקיים נשאר וניב בנו עליו").
 *
 * זרימה:
 *   1. `main.ts` מסיים render של הלוח ומפעיל `mountTrackingLayers(grid, cells)`.
 *   2. אנו עוברים על כל `.calendar-cell` בסדר התאים שניתנו, ומצמידים לו
 *      `<day-tracking-layer>` עם תאריך עברי.
 *   3. ה-component מאזין ל-store ומתעדכן עצמאית — אין צורך לרנדר שוב.
 *
 * שים לב: `.calendar-cell` הוא `<button>`. שימת `<button>` מקונן בתוכו אינו
 * חוקי-HTML (סעיף 10.1), אבל בפועל הדפדפן מטפל בזה והאירועים שלנו עוצרים
 * propagation ב-stopPropagation. כשנעבור ל-`<div role="button">` (עתידי),
 * ה-renderer הזה לא ישתנה.
 */

import './components/day-tracking-layer.js';
import type { DayTrackingLayer } from './components/day-tracking-layer.js';
import type { HebrewDate } from './tracking-types.js';

const LAYER_TAG = 'day-tracking-layer';
const LAYER_ATTR = 'data-tracking-mounted';

export interface TrackingCellInput {
  /** האלמנט של התא (כפי שיצר `createDayCell`). */
  cellEl: HTMLElement;
  /** התאריך העברי של התא. */
  hebrewDate: Pick<HebrewDate, 'year' | 'month' | 'day'>;
  /** האם להציג את כפתור ה-`+` (false לימים מחוץ לטווח). */
  showAdd?: boolean;
}

/**
 * מצמיד שכבת tracking לכל תא ברשימה. אידמפוטנטי — אם התא כבר עטוף
 * בשכבה, רק נעדכן את ה-properties.
 */
export function mountTrackingLayers(cells: TrackingCellInput[]): void {
  for (const { cellEl, hebrewDate, showAdd } of cells) {
    ensureCellIsPositioned(cellEl);
    let layer = cellEl.querySelector<DayTrackingLayer>(LAYER_TAG);
    if (!layer) {
      layer = document.createElement(LAYER_TAG) as DayTrackingLayer;
      cellEl.setAttribute(LAYER_ATTR, '1');
      cellEl.appendChild(layer);
      attachHoverTracking(cellEl, layer);
    }
    layer.year = hebrewDate.year;
    layer.month = hebrewDate.month;
    layer.day = hebrewDate.day;
    layer.showAdd = showAdd !== false;
  }
}

function ensureCellIsPositioned(cellEl: HTMLElement): void {
  // השכבה משתמשת ב-`position: absolute; inset: 0`. התא חייב להיות מקור מיקום.
  const cs = getComputedStyle(cellEl);
  if (cs.position === 'static') {
    cellEl.style.position = 'relative';
  }
}

/**
 * המרת hover ברמת התא לסימון על השכבה (ולא על התא עצמו, כדי לא להתערב
 * ב-CSS הקיים של הלוח). הסימון מועבר כ-class על ה-`<day-tracking-layer>`
 * עצמו, וה-CSS הפנימי שלה משתמש ב-`:host(.cell-hover)` כדי להציג את `+`.
 */
function attachHoverTracking(cellEl: HTMLElement, layer: HTMLElement): void {
  const onEnter = () => layer.classList.add('cell-hover');
  const onLeave = () => layer.classList.remove('cell-hover');
  cellEl.addEventListener('pointerenter', onEnter);
  cellEl.addEventListener('pointerleave', onLeave);

  // selected: התא מקבל class `is-selected` מ-`main.ts`. נשקף את זה.
  const observer = new MutationObserver(() => {
    layer.classList.toggle('cell-selected', cellEl.classList.contains('is-selected'));
  });
  observer.observe(cellEl, { attributes: true, attributeFilter: ['class'] });
  layer.classList.toggle('cell-selected', cellEl.classList.contains('is-selected'));
}

/**
 * מאזין גלובלי לאירועים שמשדרת השכבה (event delegation). מומלץ לרשום
 * את זה פעם אחת ב-init, מ-`main.ts`.
 */
export function attachTrackingEventListeners(handlers: {
  onAddRequested: (date: { year: number; month: number; day: number }) => void;
  onMarkerClicked?: (detail: { eventId: string; kind: string }) => void;
}): () => void {
  const onAdd = (e: Event) => {
    const ce = e as CustomEvent<{ year: number; month: number; day: number }>;
    handlers.onAddRequested(ce.detail);
  };
  const onMarker = (e: Event) => {
    const ce = e as CustomEvent<{ eventId: string; kind: string }>;
    handlers.onMarkerClicked?.(ce.detail);
  };
  document.addEventListener('tracking-add-event-requested', onAdd);
  document.addEventListener('tracking-marker-clicked', onMarker);
  return () => {
    document.removeEventListener('tracking-add-event-requested', onAdd);
    document.removeEventListener('tracking-marker-clicked', onMarker);
  };
}
