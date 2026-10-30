import { textOf, byIdOrder, partsOf, provedByOf, type Row, type SpecIndex, type SpecRecord } from './data';

// Patterns and their rules, as the pages show them (lathe/REFERENCE.md). A domain
// follows a pattern when the domain itself or any of its use cases `follows` it. Whether it owes each of
// the pattern's rules there, or the rule is not applicable or waived, and whether the rule is proved there,
// are the engine's answers (Coverage.pattern_rules and proved_by); the page only shows them, with the
// settings and reasons behind them. Pure logic, tested directly.

/** What a follower gives one of a pattern's settings (a setting_value row): a value, or the reason it does not apply. */
export interface SettingValue {
  value?: string;
  notApplicable?: string;
}

/** What a follower (a use case or a domain) gives a setting of the pattern, or undefined when it gives nothing. */
export function settingValue(index: SpecIndex, followerId: string, patternId: string, setting: string): SettingValue | undefined {
  const row = partsOf(index, followerId, 'setting_value').find((r) => r.pattern_id === patternId && r.setting === setting);
  return row ? settingOfRow(row) : undefined;
}

/** A setting_value row as a SettingValue. */
export const settingOfRow = (row: Row): SettingValue => ({
  ...(row.value !== undefined ? { value: textOf(row, 'value') } : {}),
  ...(row.not_applicable !== undefined ? { notApplicable: textOf(row, 'not_applicable') } : {}),
});

/** The reason a setting value gives for not applying, or null when it is a real value (or none). */
export const notApplicableReason = (given: SettingValue | undefined): string | null => given?.notApplicable?.trim() || null;

/** A setting value as the pages write it: the value, or "Not applicable: <reason>". */
export const settingText = (given: SettingValue) => (given.notApplicable !== undefined ? `Not applicable: ${given.notApplicable}` : given.value ?? '');

/** A rule's applies-when condition: the setting it reads, and the value it must (or, with `not`, must not) be. */
export interface AppliesWhen {
  setting: string;
  not: boolean;
  value: string;
}

/** A rule's applies-when condition, from its applies_when columns, or null when it has none. */
export function appliesWhenOf(rule: SpecRecord): AppliesWhen | null {
  const setting = textOf(rule.row, 'applies_when_setting');
  if (!setting) return null;
  return { setting, not: rule.row.applies_when_negated === true, value: textOf(rule.row, 'applies_when_value') };
}

/** The condition as a phrase: "scope is not single". */
export const appliesWhenText = (c: AppliesWhen) => `${c.setting} is ${c.not ? 'not ' : ''}${c.value}`;

/** A pattern's settings, from its pattern_setting rows, in order. */
export const settingsOf = (index: SpecIndex, pattern: SpecRecord) => partsOf(index, pattern.id, 'pattern_setting').map((r) => textOf(r, 'name'));

/** A pattern's rules, in ID order. */
export const rulesOf = (index: SpecIndex, patternId: string) =>
  (index.children.get(patternId) ?? []).filter((r) => r.kind === 'pattern_rule');

/** How a domain follows a pattern: through these use cases, and (`byDomain`) itself. */
export interface Followed {
  useCases: readonly SpecRecord[];
  byDomain: boolean;
}

/**
 * The patterns a domain follows, in pattern ID order: those the domain itself follows (FORMAT
 * section 9; `byDomain`, so every rule applies) and those its use cases follow, each with them.
 */
export function patternsFollowedBy(index: SpecIndex, domainId: string): { pattern: SpecRecord; useCases: SpecRecord[]; byDomain: boolean }[] {
  const byPattern = new Map<string, SpecRecord[]>();
  const ownFollows = new Set(
    (index.outgoing.get(domainId) ?? []).filter((l) => l.relation === 'follows' && index.byId.get(l.target)?.kind === 'pattern').map((l) => l.target),
  );
  for (const id of ownFollows) byPattern.set(id, []);
  for (const r of index.workspace.records) {
    if (r.kind !== 'use_case' || r.domain !== domainId) continue;
    for (const l of index.outgoing.get(r.id) ?? []) {
      if (l.relation !== 'follows' || index.byId.get(l.target)?.kind !== 'pattern') continue;
      byPattern.set(l.target, [...(byPattern.get(l.target) ?? []), r]);
    }
  }
  return [...byPattern.entries()]
    .map(([id, useCases]) => ({ pattern: index.byId.get(id)!, useCases: useCases.sort(byIdOrder), byDomain: ownFollows.has(id) }))
    .sort((a, b) => byIdOrder(a.pattern, b.pattern));
}

export type RuleStatus =
  /** Every following use case marks the rule's setting Not applicable, with these reasons. */
  | { applies: false; why: 'not-applicable'; setting: string; reasons: { useCase: string; reason: string }[] }
  /**
   * Waived: no follower meets the rule's `applies_when`. `given` holds the distinct values the
   * followers give its setting, as first written; empty when none gives a value.
   */
  | { applies: false; why: 'waived'; condition: AppliesWhen; given: string[] }
  | {
      applies: true;
      /** The rule's tests that count as its proof in the domain, as the engine's coverage says. */
      provedBy: string[];
      /** Its tests in the domain not automated yet. */
      notAutomatedBy: string[];
    };

/**
 * Whether a rule applies in a domain that follows its pattern as `followed` says, and if so what in that
 * domain proves it.
 */
export function ruleStatus(index: SpecIndex, rule: SpecRecord, domainId: string, followed: Followed): RuleStatus {
  const { useCases } = followed;
  const pattern = rule.parent ?? '';
  // Whether the rule applies is the engine's answer (Coverage.pattern_rules); it lists every rule of every pattern a
  // domain follows, so a rule it leaves out (only when the checks could not run) reads as owed and not proved.
  const standing = index.coverage.get(domainId)?.pattern_rules[rule.id] ?? 'owed';
  if (standing === 'not-applicable') {
    const setting = textOf(rule.row, 'setting').trim();
    const reasons = useCases.map((uc) => ({ useCase: uc.id, reason: notApplicableReason(settingValue(index, uc.id, pattern, setting)) ?? '' }));
    return { applies: false, why: 'not-applicable', setting, reasons };
  }
  if (standing === 'waived') {
    const condition = appliesWhenOf(rule) ?? { setting: '', not: false, value: '' };
    const domain = index.byId.get(domainId);
    const followers = [...(followed.byDomain && domain ? [domain] : []), ...useCases];
    const values = new Map<string, string>();
    for (const f of followers) {
      const g = settingValue(index, f.id, pattern, condition.setting);
      const value = g?.value?.trim() ?? '';
      if (value !== '' && notApplicableReason(g) === null && !values.has(value.toLowerCase())) values.set(value.toLowerCase(), value);
    }
    return { applies: false, why: 'waived', condition, given: [...values.values()] };
  }
  const notAutomatedBy = (index.children.get(rule.id) ?? [])
    .filter((t) => t.kind === 'pattern_rule_test' && textOf(t.row, 'domain_id') === domainId && textOf(t.row, 'state') === 'not automated yet')
    .sort(byIdOrder)
    .map((t) => t.id);
  return { applies: true, provedBy: provedByOf(index, rule.id, domainId), notAutomatedBy };
}
