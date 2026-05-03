/**
 * מנוע חישוב הצעות פרישה.
 *
 * עיקרון: המנוע אינו מחזיק שום תנאי הלכתי קשיח. הוא קורא את הכללים מ-JSON
 * (`halachic-rules.json`) ומפעיל אופרטורים גנריים בלבד:
 *
 *   - `shift_by_hebrew_month_same_day` — עונת החודש
 *   - `count_inclusive_days`           — עונה בינונית 30/31
 *   - `fixed_interval`                 — הפלגה
 *   - `weekday_match`                  — (עתידי) וסת יום השבוע
 *
 * הוספת כלל הלכתי חדש = להוסיף אופרטור גנרי כאן + רשומה ב-JSON.
 * אסור להחליף תנאי `if` ספציפי על הלכה ב-TypeScript.
 *
 * המנוע אינו DOM. הוא מקבל אירועי משתמש ומחזיר `EngineRunResult` עם
 * `CalculationProposal[]`. ה-flow אחראי על הצגה, אישור, וקריאה ל-store.
 */

import type {
  CalculationProposal,
  ComputedEvent,
  EngineRunResult,
  HalachicRule,
  HebrewDate,
  Onah,
  OnahWindow,
  UserEvent,
} from './tracking-types.js';
import { getEnabledRules, getCopy } from './tracking-rules-loader.js';
import {
  addDaysToHebrew,
  addOnahs,
  daysBetweenInclusive,
  hebrewToGregKey,
  newId,
  nowIso,
  shiftByHebrewMonth,
} from './tracking-utils.js';

// ─── Operators ───────────────────────────────────────────────────────────────

interface OperatorContext {
  rule: HalachicRule;
  triggerEvents: UserEvent[];   // האירועים שעליהם הכלל מופעל
}

interface OperatorOutput {
  targets: HebrewDate[];
  warnings: string[];
  metadata: Record<string, string | number | boolean>;
}

type Operator = (ctx: OperatorContext) => OperatorOutput;

const OPERATORS: Record<string, Operator> = {
  shift_by_hebrew_month_same_day(ctx) {
    const source = ctx.triggerEvents[0];
    if (!source) return { targets: [], warnings: ['no source event'], metadata: {} as Record<string, string | number | boolean> };
    const interval = (ctx.rule.operation.params.interval as number) ?? 1;
    const fallback =
      (ctx.rule.operation.params.missingDayFallback as
        | 'next_month_first_day'
        | 'previous_existing_day'
        | 'skip') ?? 'next_month_first_day';
    const result = shiftByHebrewMonth(source.hebrewDate, interval, fallback);
    const metadata: Record<string, string | number | boolean> = { monthOffset: interval };
    return {
      targets: result.target ? [result.target] : [],
      warnings: result.warning ? [result.warning] : [],
      metadata,
    };
  },

  count_inclusive_days(ctx) {
    const source = ctx.triggerEvents[0];
    if (!source) return { targets: [], warnings: ['no source event'], metadata: {} as Record<string, string | number | boolean> };
    const targets = (ctx.rule.operation.params.targets as number[] | undefined) ?? [30, 31];
    const countFrom = (ctx.rule.operation.params.countFrom as number) ?? 1;
    // יום האירוע נספר כ-`countFrom` (ברוב המקרים 1).
    // לכן יום ה-N inclusive = הוספת (N - countFrom) ימים גרגוריאניים.
    const out: HebrewDate[] = [];
    for (const n of targets) {
      const target = addDaysToHebrew(source.hebrewDate, n - countFrom);
      out.push(target);
    }
    const metadata: Record<string, string | number | boolean> = {
      countFrom,
      targetsList: targets.join(','),
    };
    return { targets: out, warnings: [], metadata };
  },

  fixed_interval(ctx) {
    // הפלגה: צריך לפחות שני אירועי משתמש כדי לחשב מרחק.
    if (ctx.triggerEvents.length < 2) {
      return { targets: [], warnings: ['needs at least 2 events for haflagah'], metadata: {} as Record<string, string | number | boolean> };
    }
    // האירועים מסודרים מהישן לחדש. נחשב את המרחק בין השניים האחרונים.
    const [prev, curr] = ctx.triggerEvents.slice(-2) as [UserEvent, UserEvent];
    const distance = daysBetweenInclusive(prev.hebrewDate, curr.hebrewDate);
    // היעד: אותו מרחק מ-`curr` קדימה. (יום האירוע נספר כ-1, לכן +distance-1.)
    const target = addDaysToHebrew(curr.hebrewDate, distance - 1);
    const metadata: Record<string, string | number | boolean> = { distance };
    return { targets: [target], warnings: [], metadata };
  },

  weekday_match(_ctx) {
    // לא מיושם בשלב א'. מוגדר כדי שהסכמה תכיר אותו.
    return { targets: [], warnings: ['weekday_match not implemented yet'], metadata: {} as Record<string, string | number | boolean> };
  },
};

// ─── מיון אירועים ────────────────────────────────────────────────────────────

function sortUserEventsAsc(events: UserEvent[]): UserEvent[] {
  return [...events].sort((a, b) => {
    if (a.hebrewDate.year !== b.hebrewDate.year) return a.hebrewDate.year - b.hebrewDate.year;
    if (a.hebrewDate.month !== b.hebrewDate.month) return a.hebrewDate.month - b.hebrewDate.month;
    if (a.hebrewDate.day !== b.hebrewDate.day) return a.hebrewDate.day - b.hebrewDate.day;
    // עונה: לילה לפני יום
    const oa = a.onah === 'night' ? 0 : 1;
    const ob = b.onah === 'night' ? 0 : 1;
    return oa - ob;
  });
}

function selectTriggerEvents(rule: HalachicRule, allEvents: UserEvent[]): UserEvent[] {
  const sorted = sortUserEventsAsc(
    allEvents.filter((e) => !e.ignoreForAllCalculations && !e.excludedRuleIds?.includes(rule.id)),
  );
  switch (rule.trigger.input) {
    case 'latest_user_event':
      return sorted.length > 0 ? [sorted[sorted.length - 1]!] : [];
    case 'last_n_events': {
      const n = rule.trigger.n ?? 2;
      return sorted.slice(-n);
    }
    case 'all_user_events':
      return sorted;
    default:
      return sorted;
  }
}

// ─── יצירת ComputedEvent מתוך הצעה ───────────────────────────────────────────

/**
 * ממיר `CalculationProposal` ל-`ComputedEvent[]` (לאחר אישור משתמש).
 * כל יעד הופך ל-`ComputedEvent` נפרד עם `status: 'pending_confirmation'`,
 * וסטטוס משתנה ל-`'confirmed'` ע"י ה-flow אחרי אישור.
 */
export function proposalToComputedEvents(
  proposal: CalculationProposal,
  status: ComputedEvent['status'] = 'pending_confirmation',
): ComputedEvent[] {
  const at = nowIso();
  return proposal.targetHebrewDates.map((date): ComputedEvent => ({
    id: newId(),
    type: 'computed_event',
    category: proposal.category,
    patternKind: proposal.patternKind,
    hebrewDate: date,
    gregorianDateKey: hebrewToGregKey(date),
    onah: proposal.targetOnah,
    status,
    sourceUserEventIds: proposal.sourceUserEventIds,
    relatedUserEventIds: proposal.sourceUserEventIds,
    relatedComputedEventIds: proposal.relatedComputedEventIds,
    reasonCode: proposal.reasonCode,
    ruleId: proposal.ruleId,
    explanation: getCopy(proposal.copyKey, 'confirmations', proposal.metadata as Record<string, string | number>),
    computedFromIntervalDays: proposal.computedFromIntervalDays,
    computedFromMonthOffset: proposal.computedFromMonthOffset,
    priority: 0,
    createdAt: at,
    confirmedAt: status === 'confirmed' ? at : undefined,
  }));
}

// ─── Run ─────────────────────────────────────────────────────────────────────

export interface EngineInputs {
  triggeredByEventId: string;
  userEvents: UserEvent[];
  existingComputedEvents: ComputedEvent[];
}

/**
 * מריץ את כל הכללים הפעילים על קלט נתון ומחזיר רשימת הצעות.
 * אינו נוגע ב-store ואינו יוצר ComputedEvents — זו אחריות ה-flow.
 */
export function runEngine(inputs: EngineInputs): EngineRunResult {
  const runId = newId();
  const proposals: CalculationProposal[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  const supersededIds: string[] = [];

  for (const rule of getEnabledRules()) {
    const triggerEvents = selectTriggerEvents(rule, inputs.userEvents);
    if (triggerEvents.length === 0) continue;

    const op = OPERATORS[rule.operation.type];
    if (!op) {
      errors.push(`unknown operator: ${rule.operation.type} (rule ${rule.id})`);
      continue;
    }
    const out = op({ rule, triggerEvents });
    if (out.targets.length === 0) {
      if (out.warnings.length > 0) warnings.push(...out.warnings);
      continue;
    }

    // עונה ליעד
    const sourceOnah: Onah | undefined = triggerEvents[triggerEvents.length - 1]?.onah;
    let targetOnah: Onah | undefined;
    switch (rule.produces.targetOnah) {
      case 'same_as_source':
        targetOnah = sourceOnah;
        break;
      case 'day':
      case 'night':
        targetOnah = rule.produces.targetOnah;
        break;
      case 'both':
        targetOnah = undefined;
        break;
    }

    // חלונות פרישה
    const targetWindows: OnahWindow[] = out.targets.map((target): OnahWindow => {
      const startOnah: Onah = targetOnah ?? 'day';
      const endShift = addOnahs(target, startOnah, rule.produces.onahsToMark - 1);
      return {
        id: newId(),
        computedEventId: '', // ייקבע כשההצעה תהפוך ל-ComputedEvent
        startHebrewDate: target,
        startOnah,
        durationOnahs: rule.produces.onahsToMark,
        endHebrewDate: endShift.date,
        endOnah: endShift.onah,
        reasonCode: rule.reasonCode,
        isExpired: false,
      };
    });

    // אירועים מחושבים קודמים מאותה קטגוריה — מועמדים לסופרסציה.
    const supersedesEventIds = inputs.existingComputedEvents
      .filter(
        (e) =>
          e.status === 'pending_confirmation' || e.status === 'confirmed',
      )
      .filter((e) => e.category === rule.category)
      .filter((e) => e.ruleId === rule.id)
      .map((e) => e.id);

    const proposal: CalculationProposal = {
      id: newId(),
      ruleId: rule.id,
      category: rule.category,
      patternKind: rule.scope.appliesToPatternKind === 'both' ? undefined : rule.scope.appliesToPatternKind,
      targetHebrewDates: out.targets,
      targetOnah,
      targetWindows,
      needsConfirmation: rule.requiresUserConfirmation,
      displayMode: rule.category === 'onah_beinonit' ? 'counting_animation' : 'anchored_popover',
      copyKey: rule.copyKey,
      reasonCode: rule.reasonCode,
      sourceUserEventIds: triggerEvents.map((e) => e.id),
      supersedesEventIds: supersedesEventIds.length > 0 ? supersedesEventIds : undefined,
      metadata: out.metadata,
      computedFromIntervalDays:
        typeof out.metadata.distance === 'number' ? (out.metadata.distance as number) : undefined,
      computedFromMonthOffset:
        typeof out.metadata.monthOffset === 'number'
          ? (out.metadata.monthOffset as number)
          : undefined,
      warnings: out.warnings.length > 0 ? out.warnings : undefined,
    };
    proposals.push(proposal);
    supersededIds.push(...supersedesEventIds);
  }

  proposals.sort((a, b) => {
    const order = ['veset_hachodesh', 'onah_beinonit', 'haflagah', 'fixed_pattern'];
    return order.indexOf(a.category) - order.indexOf(b.category);
  });

  return {
    runId,
    triggeredByEventId: inputs.triggeredByEventId,
    ranAt: nowIso(),
    proposals,
    supersededComputedEventIds: Array.from(new Set(supersededIds)),
    expiredComputedEventIds: [],
    patternStateChanges: [],
    warnings,
    errors,
  };
}
