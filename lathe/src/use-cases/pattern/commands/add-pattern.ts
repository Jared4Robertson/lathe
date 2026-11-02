import { column, parts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { PatternRow } from '../../../platform/data/tables.ts';
import type { PatternSetting } from '../model.ts';
import { ADD_PATTERN_IDENTITY } from './identities.generated.ts';
import { addPattern } from './handlers.generated.ts';

export type AddPattern = Pick<PatternRow, 'id' | 'title' | 'product_id' | 'description' | 'notes'> & { settings?: PatternSetting[] };

export const ADD_PATTERN = {
  ...ADD_PATTERN_IDENTITY,
  input: {
    id: column('pattern', 'id', 'required'),
    title: column('pattern', 'title', 'required'),
    product_id: column('pattern', 'product_id', 'required'),
    description: column('pattern', 'description', 'required'),
    notes: column('pattern', 'notes', 'optional'),
    settings: parts('pattern_setting', ['name', 'meaning'], 'Its settings in order, each a name (lower case with underscores) and what a follower decides in it.', 'optional'),
  },
  handler: addPattern,
} satisfies CommandDefinition<AddPattern>;
