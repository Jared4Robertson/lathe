// Generated from data/ by `npm run generate`. Do not edit.
// UseCaseRepository (LA-AUT-REPO11): Loads a use case whole from the transaction's draft (its actors, UC requirements
// and their tests, flows, steps with the links they start, and flow tests) and saves exactly the rows that changed, in
// the Use case aggregate's own tables only; a write to any other table is refused when it is made (`DataFiles`). A
// record inside a use case is loaded through the use case that holds it (`loadHolding`), and a removal is refused,
// naming the referrers, while anything outside what goes references it.
import { AggregateRepository as Repository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { USE_CASE_TABLES, useCaseRows, useCasesFrom, type UseCase, type UseCaseKind } from './model.ts';

export class UseCaseRepository extends Repository<UseCase> {
  constructor(tx: Transaction) {
    super(tx, 'UseCaseRepository', USE_CASE_TABLES);
  }

  protected read(rootId: string): UseCase | undefined {
    return useCasesFrom((table) => this.files.rows(table), rootId)[0];
  }

  protected rowsOf(useCase: UseCase): InstanceRows {
    return useCaseRows(useCase);
  }

  /** Loads the use case that holds the record of the kind with this ID, found up its parents; undefined when there is none. */
  loadHolding(kind: UseCaseKind, id: string): UseCase | undefined {
    const root = this.rootOf(kind, id);
    const useCase = root === undefined ? undefined : this.load(root);
    return useCase && holds(useCase, kind, id) ? useCase : undefined;
  }

  // The root's ID, up the parents of the record of the kind with this ID; undefined when one of them is missing.
  private rootOf(kind: UseCaseKind, id: string): string | undefined {
    const row = this.files.find(kind, { id });
    if (!row) return undefined;
    switch (kind) {
      case 'use_case': return id;
      case 'uc_requirement': return this.rootOf('use_case', String(row.use_case_id));
      case 'use_case_test': return this.rootOf('uc_requirement', String(row.uc_requirement_id));
      case 'flow': return this.rootOf('use_case', String(row.use_case_id));
      case 'flow_step': return this.rootOf('flow', String(row.flow_id));
      case 'flow_test': return this.rootOf('flow', String(row.flow_id));
    }
  }
}

/** Whether the use case holds the record of the kind with this ID. */
function holds(useCase: UseCase, kind: UseCaseKind, id: string): boolean {
  switch (kind) {
    case 'use_case': return useCase.root === id;
    case 'uc_requirement': return useCase.requirements.some((x) => x.id === id);
    case 'use_case_test': return useCase.useCaseTests.some((x) => x.row.id === id);
    case 'flow': return useCase.flows.some((x) => x.id === id);
    case 'flow_step': return useCase.steps.some((x) => x.row.id === id);
    case 'flow_test': return useCase.flowTests.some((x) => x.row.id === id);
  }
}
