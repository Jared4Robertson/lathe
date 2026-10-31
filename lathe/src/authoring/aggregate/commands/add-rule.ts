import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { RuleRow } from '../../../platform/data/tables.ts';
import { AGGREGATE_SLICE } from '../model.ts';
import { AggregateRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

export type AddRule = Pick<RuleRow, 'id' | 'title' | 'invariant_id' | 'file'> & { meets?: string[]; packages?: string[] };

export const ADD_RULE: CommandDefinition<AddRule> = {
  id: 'LA-AUT-CMD225',
  slice: AGGREGATE_SLICE,
  name: 'add-rule',
  description: 'Adds the rule that enforces an invariant of the aggregate: its name in code, the name its refusal carries, and its file, with the standard rules it meets and the packages it uses.',
  method: 'POST',
  route: '/api/aggregate/add-rule',
  input: {
    id: column('rule', 'id', 'required'),
    title: column('rule', 'title', 'required'),
    invariant_id: column('rule', 'invariant_id', 'required'),
    file: column('rule', 'file', 'optional'),
    meets: ids('The standard rules it follows.', 'optional'),
    packages: texts('The packages it uses, each listed in one of the product\'s package.json files.', 'optional'),
  },
  handler: addRule,
};

export function addRule(tx: Transaction, input: AddRule): void {
  const aggregates = new AggregateRepository(tx);
  const aggregate = aggregates.loadHolding('invariant', input.invariant_id) ?? tx.refuse('missing', `there is no invariant ${input.invariant_id}`);
  const { meets = [], packages = [], ...row } = input;
  aggregate.rules.push({ row, meets, packages });
  holdToRules(tx, aggregate);
  aggregates.save(aggregate);
}
