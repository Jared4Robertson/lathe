// Generated from data/ by `npm run generate`. Do not edit.
// PatternRepository (LA-UCS-REPO02): Loads a pattern whole from the transaction's draft (its settings, rules and rule
// tests) and saves exactly the rows that changed, in the Pattern aggregate's own tables only; a write to any other
// table is refused when it is made (`DataFiles`). A rule or rule test is loaded through the pattern that holds it
// (`loadHolding`), and a removal is refused, naming the referrers, while anything outside references what goes.
import { AggregateRepository as Repository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { PATTERN_TABLES, patternRows, patternsFrom, type Pattern, type PatternKind } from './model.ts';

export class PatternRepository extends Repository<Pattern> {
  constructor(tx: Transaction) {
    super(tx, 'PatternRepository', PATTERN_TABLES);
  }

  protected read(rootId: string): Pattern | undefined {
    return patternsFrom((table) => this.files.rows(table), rootId)[0];
  }

  protected rowsOf(pattern: Pattern): InstanceRows {
    return patternRows(pattern);
  }

  /** Loads the pattern that holds the record of the kind with this ID, found up its parents; undefined when there is none. */
  loadHolding(kind: PatternKind, id: string): Pattern | undefined {
    const root = this.rootOf(kind, id);
    const pattern = root === undefined ? undefined : this.load(root);
    return pattern && holds(pattern, kind, id) ? pattern : undefined;
  }

  // The root's ID, up the parents of the record of the kind with this ID; undefined when one of them is missing.
  private rootOf(kind: PatternKind, id: string): string | undefined {
    const row = this.files.find(kind, { id });
    if (!row) return undefined;
    switch (kind) {
      case 'pattern': return id;
      case 'pattern_rule': return this.rootOf('pattern', String(row.pattern_id));
      case 'pattern_rule_test': return this.rootOf('pattern_rule', String(row.pattern_rule_id));
      case 'slot': return this.rootOf('pattern', String(row.pattern_id));
    }
  }
}

/** Whether the pattern holds the record of the kind with this ID. */
function holds(pattern: Pattern, kind: PatternKind, id: string): boolean {
  switch (kind) {
    case 'pattern': return pattern.root === id;
    case 'pattern_rule': return pattern.rules.some((x) => x.id === id);
    case 'pattern_rule_test': return pattern.ruleTests.some((x) => x.row.id === id);
    case 'slot': return pattern.slots.some((x) => x.id === id);
  }
}
