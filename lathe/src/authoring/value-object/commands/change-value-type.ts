import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { ValueTypeRow } from '../../../platform/data/tables.ts';
import { VALUE_OBJECT_SLICE, changed } from '../model.ts';
import { ValueObjectRepository } from '../repository.ts';

/** The value type's changes: a column given is set, null clears an optional one; a list given replaces the list. */
export type ChangeValueType = Pick<ValueTypeRow, 'id'> & { title?: ValueTypeRow['title']; file?: ValueTypeRow['file'] | null; meets?: string[]; packages?: string[] };

export const CHANGE_VALUE_TYPE: CommandDefinition<ChangeValueType> = {
  id: 'LA-AUT-CMD277',
  slice: VALUE_OBJECT_SLICE,
  name: 'change-value-type',
  description: "Changes a value type's title or file, or the standard rules it meets or packages it uses (each the whole list).",
  method: 'POST',
  route: '/api/value-object/change-value-type',
  input: {
    id: column('value_type', 'id', 'required'),
    title: column('value_type', 'title', 'optional'),
    file: column('value_type', 'file', 'clearable'),
    meets: ids('The standard rules it meets. Replaces the list.', 'optional'),
    packages: texts("The packages it uses, by their names in the product's package.json files. Replaces the list.", 'optional'),
  },
  handler: changeValueType,
};

/** Changes the value type's columns, links and packages. */
export function changeValueType(tx: Transaction, input: ChangeValueType): void {
  const valueObjects = new ValueObjectRepository(tx);
  const valueObject = valueObjects.loadHolding('value_type', input.id) ?? tx.refuse('missing', `there is no value type ${input.id}`);
  const valueType = valueObject.valueType!;
  valueObject.valueType = { row: changed(valueType.row, input, ['title', 'file']), meets: input.meets ?? valueType.meets, packages: input.packages ?? valueType.packages };
  valueObjects.save(valueObject);
}
