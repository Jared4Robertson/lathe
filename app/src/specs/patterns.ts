import type { Judgment, RecordTrace } from '../../../lathe/src/traceability/record-trace/read-model';
import { byIdOrder, type RecordIndex, type RecordSummary } from '../exploring/record-summaries/record-index';

// Patterns and their rules, as the pages show them (lathe/REFERENCE.md). A domain follows a pattern when the domain
// itself or any of its use cases `follows` it, and then owes every rule of the pattern there. What proves each rule
// there is the engine's answer: the rule's Record trace (LA-TRC-RM06) judges it in each domain that owes it. Pure
// logic, tested directly.

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

/** A rule's standing in a domain that follows its pattern: the tests that count as its proof there, and its tests there not automated yet. */
export interface RuleStatus {
  provedBy: string[];
  notAutomatedBy: string[];
}

/** A rule's standing in a domain that follows its pattern, as the rule's trace judges it there (every rule of a followed pattern is owed). */
export function ruleStatus(trace: RecordTrace, domain: string): RuleStatus {
  const judgment: Judgment | undefined = trace.judgments.find((j) => j.domain === domain);
  return { provedBy: judgment?.provedBy ?? [], notAutomatedBy: judgment?.notAutomatedBy ?? [] };
}
