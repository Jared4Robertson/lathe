// The Guarantee aggregate's rules, written once: every load and commit runs them over all data (guaranteeRules, listed
// in AGGREGATE_RULES), so a guarantee added to a business domain, and a platform domain unmarked while it makes one, are
// refused.
import type { AggregateRules, RuleProblem } from '../../platform/data/rules.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { DomainRow, GuaranteeRow } from '../../platform/data/tables.ts';
import { GUARANTEE_AGGREGATE } from './model.ts';

/**
 * Every guarantee that breaks LA-MOD-INV187: a guarantee sits in a domain marked platform. A business domain is
 * described by its use cases and aggregates and makes no guarantee.
 */
export function guaranteeInPlatformDomain(guarantees: readonly GuaranteeRow[], domains: readonly DomainRow[]): RuleProblem[] {
  const platform = new Set(domains.filter((d) => d.platform === true).map((d) => d.id));
  const known = new Set(domains.map((d) => d.id));
  return guarantees
    .filter((g) => known.has(g.domain_id) && !platform.has(g.domain_id))
    .map((g) => ({
      rule: 'guarantee-in-platform-domain',
      table: 'guarantee',
      row: g as unknown as Row,
      message: `${g.domain_id} is not marked platform, so it makes no guarantee and ${g.id} cannot sit in it: a guarantee sits in a platform domain, and a business domain is described by its use cases and aggregates`,
    }));
}

/** The rules over all data. */
export const guaranteeRules: AggregateRules = {
  aggregate: GUARANTEE_AGGREGATE,
  check: (view) => guaranteeInPlatformDomain(view.rows('guarantee') as unknown as GuaranteeRow[], view.rows('domain') as unknown as DomainRow[]),
};
