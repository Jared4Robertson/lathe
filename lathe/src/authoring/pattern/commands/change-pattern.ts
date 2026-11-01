import { column, parts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { PatternRow } from '../../../platform/data/tables.ts';
import type { PatternSetting } from '../model.ts';
import { CHANGE_PATTERN_IDENTITY } from './identities.generated.ts';
import { changePattern } from './handlers.generated.ts';

/** The pattern's changes: a column given is set, null clears an optional one; settings, when given, replace the list. */
export type ChangePattern = Pick<PatternRow, 'id'> & { title?: PatternRow['title']; description?: PatternRow['description']; notes?: PatternRow['notes'] | null; settings?: PatternSetting[] };

export const CHANGE_PATTERN = {
  ...CHANGE_PATTERN_IDENTITY,
  input: {
    id: column('pattern', 'id', 'required'),
    title: column('pattern', 'title', 'optional'),
    description: column('pattern', 'description', 'optional'),
    notes: column('pattern', 'notes', 'clearable'),
    settings: parts('pattern_setting', ['name', 'meaning'], 'Its settings in order, each a name (lower case with underscores) and what a follower decides in it. Replaces the list.', 'optional'),
  },
  handler: changePattern,
} satisfies CommandDefinition<ChangePattern>;
