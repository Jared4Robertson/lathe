// The Endpoint aggregate's rules, written once: each command's handler runs them on the rows it would save, and every
// load and commit runs them over all data (endpointRules, listed in AGGREGATE_RULES).
import { beyondFirst, type AggregateRules, type RuleProblem } from '../../platform/data/rules.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { EndpointHandlerRow } from '../../platform/data/tables.ts';
import { ENDPOINT_AGGREGATE } from './model.ts';

/** Every row that breaks LA-IXD-INV110: an endpoint has at most one endpoint handler. Each after the first is refused. */
export function oneEndpointHandler(handlers: readonly EndpointHandlerRow[]): RuleProblem[] {
  return beyondFirst(handlers, (r) => r.endpoint_id).map((r) => ({
    rule: 'one-endpoint-handler',
    table: 'endpoint_handler',
    row: r as unknown as Row,
    message: `endpoint ${r.endpoint_id} already has its endpoint handler, so ${r.id} cannot be a second: an endpoint has one`,
  }));
}

/** The rules over all data. */
export const endpointRules: AggregateRules = {
  aggregate: ENDPOINT_AGGREGATE,
  check: (view) => oneEndpointHandler(view.rows('endpoint_handler') as unknown as EndpointHandlerRow[]),
};
