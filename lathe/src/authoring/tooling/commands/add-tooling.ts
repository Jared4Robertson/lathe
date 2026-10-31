import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { ToolingRow } from '../../../platform/data/tables.ts';
import { TOOLING_SLICE } from '../model.ts';
import { ToolingRepository } from '../repository.ts';

export type AddTooling = Pick<ToolingRow, 'id' | 'title' | 'domain_id' | 'file'> & { packages?: string[]; meets?: string[] };

export const ADD_TOOLING: CommandDefinition<AddTooling> = {
  id: 'LA-AUT-CMD155',
  slice: TOOLING_SLICE,
  name: 'add-tooling',
  description: 'Adds a tooling record under its domain, with the packages it uses and the standard rules it meets.',
  method: 'POST',
  route: '/api/tooling/add-tooling',
  input: {
    id: column('tooling', 'id', 'required'),
    title: column('tooling', 'title', 'required'),
    domain_id: column('tooling', 'domain_id', 'required'),
    file: column('tooling', 'file', 'optional'),
    packages: texts('The packages it uses, as the product\'s package.json files list them.', 'optional'),
    meets: ids('The standard rules it meets.', 'optional'),
  },
  handler: addTooling,
};

/** Adds the tooling record, whole and new. */
export function addTooling(tx: Transaction, input: AddTooling): void {
  const records = new ToolingRepository(tx);
  if (tx.record(input.id)) tx.refuse('primary-key', `tooling ${input.id} already exists`);
  if (tx.record(input.domain_id)?.kind !== 'domain') tx.refuse('missing', `there is no domain ${input.domain_id}`);
  const { packages = [], meets = [], ...row } = input;
  const record = records.create({ root: row.id, tooling: row, packages: [...packages].sort(), meets: [...meets].sort() });
  records.save(record);
}
