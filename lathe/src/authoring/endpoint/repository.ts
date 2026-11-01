// Generated from data/ by `npm run generate`. Do not edit.
// EndpointRepository (LA-AUT-REPO13): Loads an endpoint whole from the transaction's draft (its API requirements and
// their endpoint tests, and its handler with the standard rules it meets and the packages it uses) and saves exactly
// the rows that changed, in the Endpoint aggregate's own tables only; a write to any other table is refused when it is
// made.
import { AggregateRepository as Repository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { ENDPOINT_TABLES, endpointRows, endpointsFrom, type Endpoint, type EndpointKind } from './model.ts';

export class EndpointRepository extends Repository<Endpoint> {
  constructor(tx: Transaction) {
    super(tx, 'EndpointRepository', ENDPOINT_TABLES);
  }

  protected read(rootId: string): Endpoint | undefined {
    return endpointsFrom((table) => this.files.rows(table), rootId)[0];
  }

  protected rowsOf(endpoint: Endpoint): InstanceRows {
    return endpointRows(endpoint);
  }

  /** Loads the endpoint that holds the record of the kind with this ID, found up its parents; undefined when there is none. */
  loadHolding(kind: EndpointKind, id: string): Endpoint | undefined {
    const root = this.rootOf(kind, id);
    const endpoint = root === undefined ? undefined : this.load(root);
    return endpoint && holds(endpoint, kind, id) ? endpoint : undefined;
  }

  // The root's ID, up the parents of the record of the kind with this ID; undefined when one of them is missing.
  private rootOf(kind: EndpointKind, id: string): string | undefined {
    const row = this.files.find(kind, { id });
    if (!row) return undefined;
    switch (kind) {
      case 'endpoint': return id;
      case 'api_requirement': return this.rootOf('endpoint', String(row.endpoint_id));
      case 'endpoint_handler': return this.rootOf('endpoint', String(row.endpoint_id));
      case 'endpoint_test': return this.rootOf('api_requirement', String(row.api_requirement_id));
    }
  }
}

/** Whether the endpoint holds the record of the kind with this ID. */
function holds(endpoint: Endpoint, kind: EndpointKind, id: string): boolean {
  switch (kind) {
    case 'endpoint': return endpoint.root === id;
    case 'api_requirement': return endpoint.requirements.some((x) => x.id === id);
    case 'endpoint_handler': return endpoint.handler?.row.id === id;
    case 'endpoint_test': return endpoint.tests.some((x) => x.row.id === id);
  }
}
