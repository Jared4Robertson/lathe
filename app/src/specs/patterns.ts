import { byIdOrder, type SpecIndex, type SpecLink, type SpecRecord } from './data';

// Patterns and their rules, as the pages show them (FORMAT.md sections 10 and 11). A domain
// follows a pattern when the domain itself or any of its use cases `follows` it, and then owes each
// of the pattern's rules: designed when a component in the domain satisfies it, built when that
// component's file exists, proved when an automated or manual test in the domain proves it, planned
// when only a planned test there does. A rule does not apply in a domain when it names a setting that
// all the domain's following use cases mark `Not applicable:` with a reason (unless the domain follows
// the pattern itself), or when no follower there meets its `applies_when`: it is waived there, as the
// engine's owed_pattern_rules table counts it (lathe/src/coverage.ts). Pure logic, tested directly.

const NOT_APPLICABLE = /^not applicable:\s*(.*)$/is;

/** The reason a setting value gives for not applying, or null when it is a real value. */
export function notApplicableReason(value: string | undefined): string | null {
  const m = value?.trim().match(NOT_APPLICABLE);
  return m ? m[1].trim() : null;
}

/** A rule's `applies_when`: the setting it reads, and the value it must (or, with `not`, must not) be. */
export interface AppliesWhen {
  setting: string;
  not: boolean;
  value: string;
}

const APPLIES_WHEN = /^(\S+)\s+is\s+(not\s+)?(\S.*)$/is;

/**
 * A rule's `applies_when`, or null when it has none. A malformed one, or one naming a setting its pattern
 * does not list, is an applies-when-unknown error and waives nothing, so it is null too.
 */
export function appliesWhenOf(index: SpecIndex, rule: SpecRecord): AppliesWhen | null {
  const m = rule.fields.applies_when?.trim().match(APPLIES_WHEN);
  const pattern = rule.parent ? index.byId.get(rule.parent) : undefined;
  if (!m || !pattern || pattern.kind !== 'pattern' || !settingsOf(pattern).includes(m[1])) return null;
  return { setting: m[1], not: !!m[2], value: m[3].trim() };
}

/** `applies_when` as a phrase: "scope is not single". */
export const appliesWhenText = (c: AppliesWhen) => `${c.setting} is ${c.not ? 'not ' : ''}${c.value}`;

/** Whether a follower's value for the setting meets the condition: a real value, compared trimmed and in any letter case. */
export function meetsAppliesWhen(c: AppliesWhen, value: string | undefined): boolean {
  const given = value?.trim() ?? '';
  if (given === '' || /^not\s+applicable\s*:/i.test(given)) return false;
  return (given.toLowerCase() === c.value.toLowerCase()) !== c.not;
}

/** A pattern's settings, from its space-separated `settings` field. */
export const settingsOf = (pattern: SpecRecord) => (pattern.fields.settings ?? '').split(/\s+/).filter(Boolean);

/** A pattern's rules, in ID order. */
export const rulesOf = (index: SpecIndex, patternId: string) =>
  (index.children.get(patternId) ?? []).filter((r) => r.kind === 'pattern_rule');

/** The use cases that follow a pattern, in ID order. */
export function followersOf(index: SpecIndex, patternId: string): SpecRecord[] {
  return (index.incoming.get(patternId) ?? [])
    .filter((l) => l.relation === 'follows')
    .map((l) => index.byId.get(l.source))
    .filter((r): r is SpecRecord => !!r && r.kind === 'use_case')
    .sort(byIdOrder);
}

/** How a domain follows a pattern: through these use cases, and (`byDomain`) itself. */
export interface Followed {
  useCases: readonly SpecRecord[];
  byDomain: boolean;
}

/**
 * The domains that follow a pattern, each with its following use cases and whether the domain itself
 * follows it, in domain ID order.
 */
export function followingDomains(index: SpecIndex, patternId: string): ({ domain: string; useCases: SpecRecord[] } & Followed)[] {
  const byDomain = new Map<string, SpecRecord[]>();
  const itself = new Set<string>();
  for (const l of index.incoming.get(patternId) ?? []) {
    if (l.relation === 'follows' && index.byId.get(l.source)?.kind === 'domain') {
      itself.add(l.source);
      if (!byDomain.has(l.source)) byDomain.set(l.source, []);
    }
  }
  for (const uc of followersOf(index, patternId)) {
    if (!uc.domain) continue;
    byDomain.set(uc.domain, [...(byDomain.get(uc.domain) ?? []), uc]);
  }
  return [...byDomain.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }))
    .map(([domain, useCases]) => ({ domain, useCases, byDomain: itself.has(domain) }));
}

/**
 * The patterns a domain follows, in pattern ID order: those the domain itself follows (FORMAT
 * section 10; `byDomain`, so every rule applies) and those its use cases follow, each with them.
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
      /** Components in the domain that design the rule. */
      designedBy: string[];
      /** Those of them whose file exists. */
      builtBy: string[];
      /** Automated or manual tests in the domain that prove the rule. */
      provedBy: string[];
      /** Planned tests in the domain meant to prove it. */
      plannedBy: string[];
    };

/** The role ('design', 'proof' or '') of a link, from the meta-model's relation rules. */
export function linkRole(index: SpecIndex, link: SpecLink): '' | 'design' | 'proof' {
  const source = index.byId.get(link.source)?.kind;
  const target = index.byId.get(link.target)?.kind;
  const rule = index.workspace.relations.find((r) =>
    r.relation === link.relation && r.source_kind === source && (r.target_kind === target || r.target_kind === '*'));
  return rule?.role ?? '';
}

const testStateOf = (r: SpecRecord) => r.fields.state?.trim() || 'automated';

/**
 * Whether a rule applies in a domain that follows its pattern as `followed` says, and if so what in that
 * domain designs, builds and proves it.
 */
export function ruleStatus(index: SpecIndex, rule: SpecRecord, domainId: string, followed: Followed): RuleStatus {
  const { useCases } = followed;
  const setting = rule.fields.setting?.trim();
  if (setting && !followed.byDomain && useCases.length > 0) {
    const reasons = useCases.map((uc) => ({ useCase: uc.id, reason: notApplicableReason(uc.fields[setting]) }));
    if (reasons.every((r) => r.reason !== null)) {
      return { applies: false, why: 'not-applicable', setting, reasons: reasons.map((r) => ({ useCase: r.useCase, reason: r.reason! })) };
    }
  }
  const condition = appliesWhenOf(index, rule);
  if (condition) {
    const domain = index.byId.get(domainId);
    const followers = [...(followed.byDomain && domain ? [domain] : []), ...useCases];
    if (!followers.some((f) => meetsAppliesWhen(condition, f.fields[condition.setting]))) {
      const given = new Map<string, string>();
      for (const f of followers) {
        const value = f.fields[condition.setting]?.trim() ?? '';
        if (value !== '' && notApplicableReason(value) === null && !given.has(value.toLowerCase())) given.set(value.toLowerCase(), value);
      }
      return { applies: false, why: 'waived', condition, given: [...given.values()] };
    }
  }
  const designedBy: string[] = [];
  const builtBy: string[] = [];
  const provedBy: string[] = [];
  const plannedBy: string[] = [];
  for (const l of index.incoming.get(rule.id) ?? []) {
    const source = index.byId.get(l.source);
    if (!source || source.domain !== domainId) continue;
    const role = linkRole(index, l);
    if (role === 'design') {
      designedBy.push(source.id);
      const fileMissing = (index.problemsFor.get(source.id) ?? []).some((p) => p.check === 'component-file-missing');
      if (source.kind === 'component' && source.fields.file && !fileMissing) builtBy.push(source.id);
    } else if (role === 'proof' && source.kind === 'test') {
      (testStateOf(source) === 'planned' ? plannedBy : provedBy).push(source.id);
    }
  }
  const sorted = (ids: string[]) => [...new Set(ids)].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  return { applies: true, designedBy: sorted(designedBy), builtBy: sorted(builtBy), provedBy: sorted(provedBy), plannedBy: sorted(plannedBy) };
}
