// Set the product's limits (LA-CHK-CMD04): Sets a product's settings row: the most children of one kind a record should hold, and the most entities an aggregate should hold. A product without the row takes the defaults, 15 and 7.
import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { ProductSettingRow } from '../../../platform/data/tables.ts';
import { PRODUCT_SETTING_SLICE } from '../model.ts';
import { ProductSettingRepository } from '../repository.ts';

/** The product and both its limits. */
export type SetLimits = ProductSettingRow;

/** Set the product's limits (LA-CHK-CMD04). */
export const SET_LIMITS: CommandDefinition<SetLimits> = {
  id: 'LA-CHK-CMD04',
  slice: PRODUCT_SETTING_SLICE,
  name: 'set-limits',
  description: "Sets a product's settings row: the most children of one kind a record should hold, and the most entities an aggregate should hold. A product without the row takes the defaults, 15 and 7.",
  method: 'POST',
  route: '/api/product-setting/set-limits',
  input: {
    product_id: column('product_setting', 'product_id', 'required'),
    max_children: column('product_setting', 'max_children', 'required'),
    max_entities_per_aggregate: column('product_setting', 'max_entities_per_aggregate', 'required'),
  },
  handler: setLimits,
};

/** Sets the product's settings, adding its one row (LA-CHK-INV05) the first time. */
export function setLimits(tx: Transaction, input: SetLimits): void {
  const settings = new ProductSettingRepository(tx);
  const setting = settings.load(input.product_id) ?? settings.create({ root: input.product_id, setting: input });
  setting.setting = input;
  settings.save(setting);
}
