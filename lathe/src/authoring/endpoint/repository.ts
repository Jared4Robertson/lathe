// EndpointRepository (LA-AUT-REPO13): loads and saves the Endpoint aggregate whole, in its own tables only. An API
// requirement, an endpoint handler or an endpoint test is reached through the endpoint that holds it.
import { AggregateRepository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { ENDPOINT_TABLES, endpointRows, endpointsFrom, kindInside, type Endpoint, type EndpointKind } from './model.ts';

export class EndpointRepository extends AggregateRepository<Endpoint> {
  constructor(tx: Transaction) {
    super(tx, 'EndpointRepository', ENDPOINT_TABLES);
  }

  protected read(rootId: string): Endpoint | undefined {
    return endpointsFrom((table) => this.files.rows(table), rootId)[0];
  }

  protected rowsOf(endpoint: Endpoint): InstanceRows {
    return endpointRows(endpoint);
  }

  /**
   * Loads the endpoint that holds the record of the kind with this ID: the endpoint itself, or the endpoint of the
   * requirement, handler or test, found up its parents. Undefined when there is no such record.
   */
  loadHolding(kind: EndpointKind, id: string): Endpoint | undefined {
    let at: { kind: EndpointKind; id: string } = { kind, id };
    while (at.kind !== 'endpoint') {
      const row = this.files.find(at.kind, { id: at.id });
      if (!row) return undefined;
      at = at.kind === 'endpoint_test' ? { kind: 'api_requirement', id: String(row.api_requirement_id) } : { kind: 'endpoint', id: String(row.endpoint_id) };
    }
    const endpoint = this.load(at.id);
    return endpoint && kindInside(endpoint, id) === kind ? endpoint : undefined;
  }
}
