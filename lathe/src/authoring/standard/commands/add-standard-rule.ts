import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { StandardRuleRow } from '../../../platform/data/tables.ts';
import { STANDARD_SLICE } from '../model.ts';
import { StandardRepository } from '../repository.ts';

/** A new standard rule. */
export type AddStandardRule = Pick<StandardRuleRow, 'id' | 'title' | 'standard_id' | 'statement' | 'group_name'>;

export const ADD_STANDARD_RULE: CommandDefinition<AddStandardRule> = {
  id: 'LA-AUT-CMD203',
  slice: STANDARD_SLICE,
  name: 'add-standard-rule',
  description: 'Adds a rule to its standard.',
  method: 'POST',
  route: '/api/standard/add-standard-rule',
  input: {
    id: column('standard_rule', 'id', 'required'),
    title: column('standard_rule', 'title', 'required'),
    standard_id: column('standard_rule', 'standard_id', 'required'),
    statement: column('standard_rule', 'statement', 'required'),
    group_name: column('standard_rule', 'group_name', 'optional'),
  },
  handler: addStandardRule,
};

/** Adds the rule to its standard. */
export function addStandardRule(tx: Transaction, input: AddStandardRule): void {
  const standards = new StandardRepository(tx);
  const standard = standards.load(input.standard_id) ?? tx.refuse('missing', `there is no standard ${input.standard_id}`);
  standard.rules.push(input);
  standards.save(standard);
}
