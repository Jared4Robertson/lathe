// The Domain aggregate's rules, written once: each command's handler runs them on the instance before it saves, and
// every load and commit runs them over all data (domainRules, listed in AGGREGATE_RULES).
import type { AggregateRules, ReadView, RuleProblem } from '../../platform/data/rules.ts';
import type { Row } from '../../platform/data/rows.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { DOMAIN_AGGREGATE, domainsFrom, type Domain } from './model.ts';

/**
 * Every rule the domain breaks (LA-AUT-INV41 an aggregate has one repository: a repository share names an aggregate
 * no repository persists). The view gives the persists links of the other domains' repositories.
 */
export function domainProblems(domain: Domain, view: ReadView): RuleProblem[] {
  const own = new Set(domain.repositories.map((r) => r.row.id));
  const persistedBy = new Map<string, string>();
  for (const link of view.rows('persists')) if (!own.has(String(link.source_id))) persistedBy.set(String(link.target_id), String(link.source_id));
  for (const repository of domain.repositories) if (repository.persists !== null) persistedBy.set(repository.persists, repository.row.id);
  const problems: RuleProblem[] = [];
  for (const repository of domain.repositories) {
    for (const share of repository.shares) {
      const persister = persistedBy.get(share.aggregate_id);
      if (persister === undefined) continue;
      problems.push({
        rule: 'repository-share-unpersisted',
        table: 'repository_share',
        row: share as unknown as Row,
        message: `${share.repository_id} cannot also record ${share.aggregate_id}, ${persister === share.repository_id ? 'the aggregate it persists' : `which ${persister} persists: an aggregate has one repository`}`,
      });
    }
  }
  return problems;
}

/** The rules over all data: every domain, whole. */
export const domainRules: AggregateRules = {
  aggregate: DOMAIN_AGGREGATE,
  check: (view) => domainsFrom((table) => view.rows(table)).flatMap((domain) => domainProblems(domain, view)),
};

/** Refuses the command, with every reason, when the domain as it would be saved breaks one of its rules. */
export function holdToRules(tx: Transaction, domain: Domain): void {
  const problems = domainProblems(domain, tx);
  if (problems.length) throw new StoreError(problems.map((p) => ({ rule: p.rule, table: p.table, message: p.message, command: 0 })));
}
