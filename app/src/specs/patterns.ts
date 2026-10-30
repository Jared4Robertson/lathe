import type { Judgment, RecordTrace } from '../../../lathe/src/traceability/record-trace/read-model';
import type { FollowingDomain } from '../../../lathe/src/traceability/pattern-following/read-model';
import { byIdOrder, type RecordIndex, type RecordSummary } from '../exploring/record-summaries/record-index';

// Patterns and their rules, as the pages show them (lathe/REFERENCE.md). A domain follows a pattern when the domain
// itself or any of its use cases `follows` it. Whether it owes each of the pattern's rules there, and what proves the
// rule there, are the engine's answers: the rule's Record trace (LA-TRC-RM06) judges it in each domain that owes it.
// A domain that follows the pattern and does not owe the rule has every following use case mark the rule's setting
// Not applicable; the reasons are the followings' (Pattern following, LA-TRC-RM10). Pure logic, tested directly.

/** How a domain follows a pattern: through these use cases, and (`byDomain`) itself. */
export interface Followed {
  useCases: readonly RecordSummary[];
  byDomain: boolean;
}

/**
 * The patterns a domain follows, in pattern ID order: those the domain itself follows (`byDomain`, so every rule
 * applies) and those its use cases follow, each with them, from the links of the space's records.
 */
export function patternsFollowedBy(index: RecordIndex, domainId: string): { pattern: RecordSummary; useCases: RecordSummary[]; byDomain: boolean }[] {
  const isPattern = (id: string) => index.byId.get(id)?.kind === 'pattern';
  const byPattern = new Map<string, RecordSummary[]>();
  const ownFollows = new Set((index.outgoing.get(domainId) ?? []).filter((l) => l.relation === 'follows' && isPattern(l.target)).map((l) => l.target));
  for (const id of ownFollows) byPattern.set(id, []);
  for (const r of index.byId.values()) {
    if (r.kind !== 'use_case' || r.domain !== domainId) continue;
    for (const l of index.outgoing.get(r.id) ?? []) {
      if (l.relation !== 'follows' || !isPattern(l.target)) continue;
      byPattern.set(l.target, [...(byPattern.get(l.target) ?? []), r]);
    }
  }
  return [...byPattern.entries()]
    .map(([id, useCases]) => ({ pattern: index.byId.get(id)!, useCases: useCases.sort(byIdOrder), byDomain: ownFollows.has(id) }))
    .sort((a, b) => byIdOrder(a.pattern, b.pattern));
}

/** A pattern's rules, in ID order. */
export const rulesOf = (index: RecordIndex, patternId: string) => (index.children.get(patternId) ?? []).filter((r) => r.kind === 'pattern_rule');

export type RuleStatus =
  /** Not owed here: every following use case marks the rule's setting Not applicable, with these reasons. */
  | { applies: false; setting: string; reasons: { useCase: string; reason: string }[] }
  /** Owed here: the tests that count as its proof in the domain, and its tests there not automated yet. */
  | { applies: true; provedBy: string[]; notAutomatedBy: string[] };

/**
 * A rule's standing in a domain that follows its pattern: owed, with its proof there, when the rule's trace judges it
 * in the domain; otherwise not applicable, with each following use case's reason for its setting.
 */
export function ruleStatus(trace: RecordTrace, domain: string, setting: string, following: FollowingDomain | undefined): RuleStatus {
  const judgment: Judgment | undefined = trace.judgments.find((j) => j.domain === domain);
  if (judgment) return { applies: true, provedBy: judgment.provedBy, notAutomatedBy: judgment.notAutomatedBy };
  const reasons = (following?.useCases ?? []).map((f) => ({ useCase: f.follower, reason: f.settings.find((s) => s.setting === setting)?.notApplicable?.trim() ?? '' }));
  return { applies: false, setting, reasons };
}
