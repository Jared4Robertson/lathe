// Add a pattern (LA-AUT-CMD190): Adds a pattern to its product, with its settings in order.
import { column, parts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { PatternRow } from '../../../platform/data/tables.ts';
import { PATTERN_SLICE, newPattern, type PatternSetting } from '../model.ts';
import { PatternRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

/** A new pattern, with its settings in order. */
export type AddPattern = Pick<PatternRow, 'id' | 'title' | 'product_id' | 'description' | 'notes'> & { settings?: PatternSetting[] };

/** Add a pattern (LA-AUT-CMD190). */
export const ADD_PATTERN: CommandDefinition<AddPattern> = {
  id: 'LA-AUT-CMD190',
  slice: PATTERN_SLICE,
  name: 'add-pattern',
  description: 'Adds a pattern to its product, with its settings in order.',
  method: 'POST',
  route: '/api/pattern/add-pattern',
  input: {
    id: column('pattern', 'id', 'required'),
    title: column('pattern', 'title', 'required'),
    product_id: column('pattern', 'product_id', 'required'),
    description: column('pattern', 'description', 'required'),
    notes: column('pattern', 'notes', 'optional'),
    settings: parts('pattern_setting', ['name', 'meaning'], 'Its settings in order, each a name (lower case with underscores) and what a follower decides in it.', 'optional'),
  },
  handler: addPattern,
};

/** Adds the pattern, whole and new, with its settings. */
export function addPattern(tx: Transaction, input: AddPattern): void {
  const patterns = new PatternRepository(tx);
  const { settings = [], ...row } = input;
  const pattern = patterns.create(newPattern(row, settings));
  holdToRules(tx, pattern);
  patterns.save(pattern);
}
