// UseCaseRepository (LA-AUT-REPO11): loads and saves the Use case aggregate whole, in its own tables only. A record
// inside a use case (a requirement, a flow, a step or a test) is reached through the use case that holds it.
import { AggregateRepository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { kindInside, USE_CASE_KINDS, USE_CASE_TABLES, useCaseRows, useCasesFrom, type UseCase, type UseCaseKind } from './model.ts';

export class UseCaseRepository extends AggregateRepository<UseCase> {
  constructor(tx: Transaction) {
    super(tx, 'UseCaseRepository', USE_CASE_TABLES);
  }

  protected read(rootId: string): UseCase | undefined {
    return useCasesFrom((table) => this.files.rows(table), rootId)[0];
  }

  protected rowsOf(useCase: UseCase): InstanceRows {
    return useCaseRows(useCase);
  }

  /**
   * Loads the use case that holds the record of the kind with this ID: the use case itself, or the use case of the
   * requirement, flow, step or test, found up its parents inside the aggregate. Undefined when there is no such record.
   */
  loadHolding(kind: UseCaseKind, id: string): UseCase | undefined {
    let at: { kind: UseCaseKind; id: string } = { kind, id };
    for (;;) {
      const row = this.files.find(at.kind, { id: at.id });
      if (!row) return undefined;
      if (at.kind === 'use_case') break;
      const column = USE_CASE_KINDS[at.kind];
      const parent = String(row[column]);
      at = { kind: column === 'use_case_id' ? 'use_case' : column === 'uc_requirement_id' ? 'uc_requirement' : 'flow', id: parent };
    }
    const useCase = this.load(at.id);
    return useCase && kindInside(useCase, id) === kind ? useCase : undefined;
  }
}
