import { column, parts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { PatternRow } from '../../../platform/data/tables.ts';
import { PATTERN_SLICE, changed, type PatternSetting } from '../model.ts';
import { PatternRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

/** The pattern's changes: a column given is set, null clears an optional one; settings, when given, replace the list. */
export type ChangePattern = Pick<PatternRow, 'id'> & { title?: PatternRow['title']; description?: PatternRow['description']; notes?: PatternRow['notes'] | null; settings?: PatternSetting[] };

export const CHANGE_PATTERN: CommandDefinition<ChangePattern> = {
  id: 'LA-AUT-CMD191',
  slice: PATTERN_SLICE,
  name: 'change-pattern',
  description: "Changes a pattern's title, description or notes, or its settings (the whole list, in order). Its product never changes.",
  method: 'POST',
  route: '/api/pattern/change-pattern',
  input: {
    id: column('pattern', 'id', 'required'),
    title: column('pattern', 'title', 'optional'),
    description: column('pattern', 'description', 'optional'),
    notes: column('pattern', 'notes', 'clearable'),
    settings: parts('pattern_setting', ['name', 'meaning'], 'Its settings in order, each a name (lower case with underscores) and what a follower decides in it. Replaces the list.', 'optional'),
  },
  handler: changePattern,
};

/** Changes the pattern's columns and settings. */
export function changePattern(tx: Transaction, input: ChangePattern): void {
  const patterns = new PatternRepository(tx);
  const pattern = patterns.load(input.id) ?? tx.refuse('missing', `there is no pattern ${input.id}`);
  pattern.pattern = changed(pattern.pattern, input, ['title', 'description', 'notes']);
  if (input.settings) pattern.settings = input.settings;
  holdToRules(tx, pattern);
  patterns.save(pattern);
}
