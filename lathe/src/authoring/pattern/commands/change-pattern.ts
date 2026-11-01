import { column, parts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { PatternRow } from '../../../platform/data/tables.ts';
import { changed, type PatternSetting } from '../model.ts';
import { PatternRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { CHANGE_PATTERN_IDENTITY } from './identities.generated.ts';

/** The pattern's changes: a column given is set, null clears an optional one; settings, when given, replace the list. */
export type ChangePattern = Pick<PatternRow, 'id'> & { title?: PatternRow['title']; description?: PatternRow['description']; notes?: PatternRow['notes'] | null; settings?: PatternSetting[] };

export const CHANGE_PATTERN: CommandDefinition<ChangePattern> = {
  ...CHANGE_PATTERN_IDENTITY,
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
