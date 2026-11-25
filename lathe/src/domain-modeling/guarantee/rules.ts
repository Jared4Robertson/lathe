// The Guarantee aggregate's rules, written once: every load and commit runs them over all data (guaranteeRules, listed
// in AGGREGATE_RULES), so a guarantee added to a business domain, and a platform domain unmarked while it makes one, are
// refused. A business domain makes guarantees only through its generated components and libraries.
import type { AggregateRules, RuleProblem } from '../../platform/data/rules.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { DomainRow, GuaranteeRow } from '../../platform/data/tables.ts';
import { GUARANTEE_AGGREGATE } from './model.ts';

/**
 * Every guarantee that breaks LA-MOD-INV187: a guarantee a domain makes sits in a domain marked platform. A business
 * domain is described by its use cases and aggregates, and makes guarantees only through what it ships.
 */
export function guaranteeInPlatformDomain(guarantees: readonly GuaranteeRow[], domains: readonly DomainRow[]): RuleProblem[] {
  const platform = new Set(domains.filter((d) => d.platform === true).map((d) => d.id));
  const known = new Set(domains.map((d) => d.id));
  return guarantees
    .filter((g) => g.domain_id !== undefined && known.has(g.domain_id) && !platform.has(g.domain_id))
    .map((g) => ({
      rule: 'guarantee-in-platform-domain',
      table: 'guarantee',
      row: g as unknown as Row,
      message: `${g.domain_id} is not marked platform, so it makes no guarantee and ${g.id} cannot sit in it: a guarantee a domain makes sits in a platform domain, and a business domain makes one only through a generated component or a library it ships`,
    }));
}

/** The rules over all data. */
export const guaranteeRules: AggregateRules = {
  aggregate: GUARANTEE_AGGREGATE,
  check: (view) => guaranteeInPlatformDomain(view.rows('guarantee') as unknown as GuaranteeRow[], view.rows('domain') as unknown as DomainRow[]),
};
