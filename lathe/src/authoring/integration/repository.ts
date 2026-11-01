// Generated from data/ by `npm run generate`. Do not edit.
// IntegrationRepository (LA-AUT-REPO14): Loads an integration whole from the transaction's draft (its adapter with the
// standard rules it meets and the packages it uses, and its integration tests) and saves exactly the rows that changed,
// in the Integration aggregate's own tables only; a write to any other table is refused when it is made.
import { AggregateRepository as Repository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { INTEGRATION_TABLES, integrationRows, integrationsFrom, type Integration, type IntegrationKind } from './model.ts';

export class IntegrationRepository extends Repository<Integration> {
  constructor(tx: Transaction) {
    super(tx, 'IntegrationRepository', INTEGRATION_TABLES);
  }

  protected read(rootId: string): Integration | undefined {
    return integrationsFrom((table) => this.files.rows(table), rootId)[0];
  }

  protected rowsOf(integration: Integration): InstanceRows {
    return integrationRows(integration);
  }

  /** Loads the integration that holds the record of the kind with this ID, found up its parents; undefined when there is none. */
  loadHolding(kind: IntegrationKind, id: string): Integration | undefined {
    const root = this.rootOf(kind, id);
    const integration = root === undefined ? undefined : this.load(root);
    return integration && holds(integration, kind, id) ? integration : undefined;
  }

  // The root's ID, up the parents of the record of the kind with this ID; undefined when one of them is missing.
  private rootOf(kind: IntegrationKind, id: string): string | undefined {
    const row = this.files.find(kind, { id });
    if (!row) return undefined;
    switch (kind) {
      case 'integration': return id;
      case 'adapter': return this.rootOf('integration', String(row.integration_id));
      case 'integration_test': return this.rootOf('integration', String(row.integration_id));
    }
  }
}

/** Whether the integration holds the record of the kind with this ID. */
function holds(integration: Integration, kind: IntegrationKind, id: string): boolean {
  switch (kind) {
    case 'integration': return integration.root === id;
    case 'adapter': return integration.adapter?.row.id === id;
    case 'integration_test': return integration.tests.some((x) => x.row.id === id);
  }
}
