// IntegrationRepository (LA-AUT-REPO14): loads and saves the Integration aggregate whole, in its own tables only. An
// adapter or an integration test is reached through the integration that holds it.
import { AggregateRepository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { INTEGRATION_TABLES, integrationRows, integrationsFrom, kindInside, type Integration, type IntegrationKind } from './model.ts';

export class IntegrationRepository extends AggregateRepository<Integration> {
  constructor(tx: Transaction) {
    super(tx, 'IntegrationRepository', INTEGRATION_TABLES);
  }

  protected read(rootId: string): Integration | undefined {
    return integrationsFrom((table) => this.files.rows(table), rootId)[0];
  }

  protected rowsOf(integration: Integration): InstanceRows {
    return integrationRows(integration);
  }

  /** Loads the integration that holds the record of the kind with this ID: the integration itself, or its adapter's or test's. */
  loadHolding(kind: IntegrationKind, id: string): Integration | undefined {
    const row = this.files.find(kind, { id });
    if (!row) return undefined;
    const integration = this.load(kind === 'integration' ? id : String(row.integration_id));
    return integration && kindInside(integration, id) === kind ? integration : undefined;
  }
}
