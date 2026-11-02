// The Integration aggregate's rules, written once: each command's handler runs them on the rows it would save, and
// every load and commit runs them over all data (integrationRules, listed in AGGREGATE_RULES).
import { beyondFirst, type AggregateRules, type RuleProblem } from '../../platform/data/rules.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { AdapterRow } from '../../platform/data/tables.ts';
import { INTEGRATION_AGGREGATE } from './model.ts';

/** Every row that breaks LA-IXD-INV111: an integration has at most one adapter. Each after the first is refused. */
export function oneAdapter(adapters: readonly AdapterRow[]): RuleProblem[] {
  return beyondFirst(adapters, (r) => r.integration_id).map((r) => ({
    rule: 'one-adapter',
    table: 'adapter',
    row: r as unknown as Row,
    message: `integration ${r.integration_id} already has its adapter, so ${r.id} cannot be a second: an integration has one`,
  }));
}

/** The rules over all data. */
export const integrationRules: AggregateRules = {
  aggregate: INTEGRATION_AGGREGATE,
  check: (view) => oneAdapter(view.rows('adapter') as unknown as AdapterRow[]),
};
