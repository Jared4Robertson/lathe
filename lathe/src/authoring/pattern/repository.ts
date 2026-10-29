// PatternRepository (LA-AUT-REPO02): loads and saves the Pattern aggregate whole, in its own tables only. A rule or a
// rule test is reached through the pattern that holds it.
import { AggregateRepository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { kindInside, PATTERN_KINDS, PATTERN_TABLES, patternRows, patternsFrom, type Pattern, type PatternKind } from './model.ts';

export class PatternRepository extends AggregateRepository<Pattern> {
  constructor(tx: Transaction) {
    super(tx, 'PatternRepository', PATTERN_TABLES);
  }

  protected read(rootId: string): Pattern | undefined {
    return patternsFrom((table) => this.files.rows(table), rootId)[0];
  }

  protected rowsOf(pattern: Pattern): InstanceRows {
    return patternRows(pattern);
  }

  /**
   * Loads the pattern that holds the record of the kind with this ID: the pattern itself, or the pattern of the rule
   * or rule test, found up its parents inside the aggregate. Undefined when there is no such record.
   */
  loadHolding(kind: PatternKind, id: string): Pattern | undefined {
    let at: { kind: PatternKind; id: string } = { kind, id };
    for (;;) {
      const row = this.files.find(at.kind, { id: at.id });
      if (!row) return undefined;
      if (at.kind === 'pattern') break;
      const column = PATTERN_KINDS[at.kind];
      at = { kind: column === 'pattern_id' ? 'pattern' : 'pattern_rule', id: String(row[column]) };
    }
    const pattern = this.load(at.id);
    return pattern && kindInside(pattern, id) === kind ? pattern : undefined;
  }
}
