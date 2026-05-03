/**
 * orchestrator: אחרי יצירת `UserEvent`, מריץ את המנוע, מציג הצעות
 * אחת-אחת בפופ-אפ אישור, ושומר `ComputedEvent` על אישור.
 *
 * אינו מבצע חישוב הלכתי בעצמו — רק מתאם בין:
 *   - `runEngine()` מ-`tracking-engine.ts`
 *   - אנימציות מ-`tracking-animations.ts`
 *   - פופ-אפ ההסבר `<anchored-calculation-popover>`
 *   - `trackingStore` לשמירת התוצאה
 *
 * ה-flow פעולתי-בלבד (imperative), כי הוא קורא בזמן אמת ל-DOM ולגלילה.
 * ההצגה התרחישית (סעיף 13) מקודדת כסדר ה-proposals מ-`runEngine`, וזה
 * נקבע מ-JSON — לכן אין כאן `if` של "עונת החודש לפני הפלגה" קשיחות.
 */

import './components/anchored-calculation-popover.js';
import type { AnchoredCalculationPopover } from './components/anchored-calculation-popover.js';
import type {
  CalculationProposal,
  EngineRunResult,
  HebrewDate,
  UserEvent,
} from './tracking-types.js';
import { runEngine, proposalToComputedEvents } from './tracking-engine.js';
import { trackingStore } from './tracking-store.js';
import { getCopy } from './tracking-rules-loader.js';
import {
  findCellByHebrewDate,
  scrollCellIntoView,
  pulseCell,
  runCountAnimation,
  clearAllCountLabels,
} from './tracking-animations.js';
import { hydrateHebrewDate, addDaysToHebrew, daysBetweenInclusive } from './tracking-utils.js';
import { toHebrewNumber } from '../../shared/hebrew-calendar.js';

// ─── מצב פנימי ────────────────────────────────────────────────────────────────

let activePopover: AnchoredCalculationPopover | null = null;
let cancelCount: (() => void) | null = null;

function destroyPopover(): void {
  activePopover?.remove();
  activePopover = null;
}

function cancelAnimations(): void {
  cancelCount?.();
  cancelCount = null;
  clearAllCountLabels();
}

// ─── הצגת הצעה ────────────────────────────────────────────────────────────────

interface ProposalUiContext {
  rootEvent: UserEvent;
}

async function presentProposal(
  proposal: CalculationProposal,
  ctx: ProposalUiContext,
): Promise<'approved' | 'dismissed'> {
  // 1. גלילה ליעד והבהוב
  const firstTarget = proposal.targetHebrewDates[0];
  const cell = firstTarget ? findCellByHebrewDate(firstTarget) : null;
  if (cell) {
    await scrollCellIntoView(cell);
  }

  // 2. אנימציית ספירה (רק לעונה בינונית/הפלגה)
  if (proposal.displayMode === 'counting_animation') {
    const sequence = buildCountSequence(proposal, ctx);
    if (sequence.length > 0) {
      const anim = runCountAnimation({ sequence });
      cancelCount = anim.cancel;
      await anim.done;
      cancelCount = null;
    }
  }

  // 3. הבהוב על תא היעד
  const stopPulse = cell ? pulseCell(cell) : () => {};

  // 4. פופ-אפ אישור
  const message = buildConfirmationMessage(proposal, ctx);
  const result = await showPopover(message, cell, proposal.id);
  stopPulse();
  clearAllCountLabels();
  return result;
}

function buildCountSequence(
  proposal: CalculationProposal,
  ctx: ProposalUiContext,
): HebrewDate[] {
  const last = proposal.targetHebrewDates[proposal.targetHebrewDates.length - 1];
  if (!last) return [];
  // יום האירוע נספר כ-1.
  const start = ctx.rootEvent.hebrewDate;
  const total = daysBetweenInclusive(start, last);
  const seq: HebrewDate[] = [];
  for (let i = 0; i < total; i++) {
    seq.push(addDaysToHebrew(start, i));
  }
  return seq;
}

function buildConfirmationMessage(
  proposal: CalculationProposal,
  ctx: ProposalUiContext,
): string {
  const eventHd = hydrateHebrewDate(ctx.rootEvent.hebrewDate);
  const target0 = proposal.targetHebrewDates[0];
  const target1 = proposal.targetHebrewDates[1];

  const onahLabel = ctx.rootEvent.onah === 'night' ? 'לילה' : 'יום';

  const vars: Record<string, string | number> = {
    eventDay: toHebrewNumber(eventHd.day),
    eventMonth: eventHd.monthName,
    onahLabel,
  };
  if (target0) {
    vars.targetDay = toHebrewNumber(target0.day);
    vars.targetMonth = target0.monthName;
    vars.firstTarget = toHebrewNumber(target0.day);
  }
  if (target1) {
    vars.secondTarget = toHebrewNumber(target1.day);
  }
  if (proposal.computedFromIntervalDays) {
    vars.distance = proposal.computedFromIntervalDays;
  }

  return getCopy(proposal.copyKey, 'confirmations', vars);
}

function showPopover(
  message: string,
  anchorCell: HTMLElement | null,
  proposalId: string,
): Promise<'approved' | 'dismissed'> {
  destroyPopover();
  return new Promise((resolve) => {
    const pop = document.createElement('anchored-calculation-popover');
    pop.message = message;
    pop.anchorRect = anchorCell?.getBoundingClientRect() ?? null;
    pop.proposalId = proposalId;
    activePopover = pop;

    const onApprove = () => {
      cleanup();
      resolve('approved');
    };
    const onDismiss = () => {
      cleanup();
      resolve('dismissed');
    };
    const cleanup = () => {
      pop.removeEventListener('proposal-approved', onApprove);
      pop.removeEventListener('proposal-dismissed', onDismiss);
      pop.remove();
      if (activePopover === pop) activePopover = null;
    };

    pop.addEventListener('proposal-approved', onApprove);
    pop.addEventListener('proposal-dismissed', onDismiss);
    document.body.appendChild(pop);
  });
}

// ─── ה-flow המלא אחרי יצירת אירוע ────────────────────────────────────────────

/**
 * נקודת כניסה: נקראת ע"י `main.ts` אחרי שדיאלוג היצירה שמר `UserEvent`.
 * מריצה מנוע, מציגה הצעות אחת-אחת לאישור, ושומרת computedEvents לפי הצורך.
 */
export async function startFlowAfterUserEvent(rootEvent: UserEvent): Promise<EngineRunResult> {
  cancelAnimations();
  destroyPopover();

  const state = trackingStore.getState();
  const result = runEngine({
    triggeredByEventId: rootEvent.id,
    userEvents: state.userEvents,
    existingComputedEvents: state.computedEvents,
  });

  // סופרסציה של הצעות ישנות שהמנוע סימן כמוחלפות.
  if (result.supersededComputedEventIds.length > 0) {
    trackingStore.supersedeComputedEvents(
      result.supersededComputedEventIds,
      rootEvent.id,
    );
  }

  // הצגה רציפה.
  for (const proposal of result.proposals) {
    if (!proposal.needsConfirmation) {
      // שמירה אוטומטית.
      proposalToComputedEvents(proposal, 'confirmed').forEach((ce) =>
        trackingStore.addComputedEvent(ce),
      );
      continue;
    }
    const decision = await presentProposal(proposal, { rootEvent });
    if (decision === 'approved') {
      proposalToComputedEvents(proposal, 'confirmed').forEach((ce) =>
        trackingStore.addComputedEvent(ce),
      );
      showToast(getCopy('prishaDayAdded', 'toasts'));
    } else {
      // לא יוצרים `ComputedEvent` — המשתמש יוכל ליצור שוב במידת הצורך.
      showToast(getCopy('stepRejected', 'toasts'));
    }
  }

  cancelAnimations();
  return result;
}

/** ביטול flow פעיל (אם המשתמש סוגר/יוצר אירוע חדש). */
export function abortActiveFlow(): void {
  cancelAnimations();
  destroyPopover();
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function showToast(message: string): void {
  const toast = document.createElement('div');
  toast.className = 'tracking-toast';
  toast.textContent = message;
  toast.setAttribute('role', 'status');
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    inset-inline-start: 50%;
    transform: translateX(50%);
    background: var(--inverse-surface, #1f1f1f);
    color: var(--inverse-on-surface, #fff);
    padding: 10px 18px;
    border-radius: 999px;
    font-size: 13px;
    box-shadow: 0 6px 16px rgba(0,0,0,0.25);
    z-index: 1100;
    direction: rtl;
    pointer-events: none;
    opacity: 0;
    transition: opacity 160ms ease;
  `;
  document.body.appendChild(toast);
  requestAnimationFrame(() => (toast.style.opacity = '1'));
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 200);
  }, 2200);
}
