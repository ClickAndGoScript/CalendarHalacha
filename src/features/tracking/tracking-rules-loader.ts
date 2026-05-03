/**
 * טעינת קבצי כללים, טקסטים וזרימה.
 *
 * הקבצים מיובאים ב-`import` סטטי כדי להשתלב ב-IIFE bundle של Vite —
 * אסור להשתמש ב-`fetch` או ב-import דינמי (ראה CLAUDE.md).
 *
 * אם בעתיד נרצה לאפשר שכתוב כללים בזמן ריצה (למשל ע"י המשתמש),
 * נטען כאן גם מה-storage ונמזג עם ברירת המחדל.
 */

import rulesJson from '../../data/rules/halachic-rules.json';
import uiCopyJson from '../../data/rules/ui-copy.he.json';
import flowJson from '../../data/rules/calculation-flow.json';
import type {
  HalachicRule,
  HalachicRulesFile,
  UiCopyFile,
  CalculationFlowFile,
} from './tracking-types.js';

interface ValidationIssue {
  path: string;
  message: string;
}

function validateRules(file: HalachicRulesFile): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (file.version !== 1) {
    issues.push({ path: 'version', message: `expected 1, got ${file.version}` });
  }
  const seenIds = new Set<string>();
  file.rules.forEach((rule, idx) => {
    const at = `rules[${idx}]`;
    if (!rule.id) issues.push({ path: at + '.id', message: 'missing id' });
    if (seenIds.has(rule.id)) {
      issues.push({ path: at + '.id', message: `duplicate id: ${rule.id}` });
    }
    seenIds.add(rule.id);
    if (!rule.category) issues.push({ path: at + '.category', message: 'missing category' });
    if (!rule.kind) issues.push({ path: at + '.kind', message: 'missing kind' });
    if (!rule.operation?.type) {
      issues.push({ path: at + '.operation.type', message: 'missing operation.type' });
    }
    if (!rule.reasonCode) {
      issues.push({ path: at + '.reasonCode', message: 'missing reasonCode' });
    }
    if (!rule.copyKey) {
      issues.push({ path: at + '.copyKey', message: 'missing copyKey' });
    }
    if (!rule.scope) {
      issues.push({ path: at + '.scope', message: 'missing scope' });
    }
  });
  return issues;
}

let cachedRules: HalachicRulesFile | null = null;
let cachedCopy: UiCopyFile | null = null;
let cachedFlow: CalculationFlowFile | null = null;

export function loadRules(): HalachicRulesFile {
  if (cachedRules) return cachedRules;
  const file = rulesJson as HalachicRulesFile;
  const issues = validateRules(file);
  if (issues.length > 0) {
    console.error('[tracking] halachic-rules.json validation issues:', issues);
    throw new Error(`Invalid halachic-rules.json: ${issues.length} issue(s)`);
  }
  cachedRules = file;
  return file;
}

export function loadUiCopy(): UiCopyFile {
  if (cachedCopy) return cachedCopy;
  cachedCopy = uiCopyJson as UiCopyFile;
  return cachedCopy;
}

export function loadFlow(): CalculationFlowFile {
  if (cachedFlow) return cachedFlow;
  cachedFlow = flowJson as CalculationFlowFile;
  return cachedFlow;
}

/** רק כללים שדגל ה-`enabled` שלהם דלוק וקבוצתם דלוקה ב-`enabledGroups`. */
export function getEnabledRules(): HalachicRule[] {
  const file = loadRules();
  const groups = file.enabledGroups;
  return file.rules.filter((rule) => {
    if (!rule.enabled) return false;
    // וסת קבוע vs שאינו קבוע — מסתמך על patternKind ב-scope
    if (rule.scope.appliesToPatternKind === 'fixed' && !groups.fixedVeset) return false;
    if (rule.scope.appliesToPatternKind === 'non_fixed' && !groups.nonFixedVeset) return false;
    return true;
  });
}

/**
 * מחפש טקסט ב-`ui-copy.he.json` לפי `copyKey`. תומך ב-placeholders
 * בצורת `{key}` שיוחלפו ב-`vars[key]`.
 */
export function getCopy(
  copyKey: string,
  section: 'confirmations' | 'toasts' | 'createEvent' | 'buttons' | 'onahLabels',
  vars?: Record<string, string | number>,
): string {
  const file = loadUiCopy();
  const sectionObj = file[section] as Record<string, string> | undefined;
  let text = sectionObj?.[copyKey];
  if (!text) {
    return `[missing copy: ${section}.${copyKey}]`;
  }
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return text;
}
