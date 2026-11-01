import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { BusinessOutcomeRow } from '../../../platform/data/tables.ts';
import { CHANGE_BUSINESS_OUTCOME_IDENTITY } from './identities.generated.ts';
import { changeBusinessOutcome } from './handlers.generated.ts';

/** The outcome's changes: a column given is set, null clears an optional one; measured_by, when given, replaces the list. */
export type ChangeBusinessOutcome = Pick<BusinessOutcomeRow, 'id'> & {
  title?: string;
  statement?: string;
  measure?: string;
  target?: string;
  measured_outside?: string | null;
  notes?: string | null;
  measured_by?: string[];
};

export const CHANGE_BUSINESS_OUTCOME = {
  ...CHANGE_BUSINESS_OUTCOME_IDENTITY,
  input: {
    id: column('business_outcome', 'id', 'required'),
    title: column('business_outcome', 'title', 'optional'),
    statement: column('business_outcome', 'statement', 'optional'),
    measure: column('business_outcome', 'measure', 'optional'),
    target: column('business_outcome', 'target', 'optional'),
    measured_outside: column('business_outcome', 'measured_outside', 'clearable'),
    notes: column('business_outcome', 'notes', 'clearable'),
    measured_by: ids('The tests, or records of the product\'s own kinds, that measure it. Replaces the list.', 'optional'),
  },
  handler: changeBusinessOutcome,
} satisfies CommandDefinition<ChangeBusinessOutcome>;
