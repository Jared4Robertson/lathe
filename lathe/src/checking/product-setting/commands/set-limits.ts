import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { ProductSettingRow } from '../../../platform/data/tables.ts';
import { ProductSettingRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { SET_LIMITS_IDENTITY } from './identities.generated.ts';

/** The product and both its limits. */
export type SetLimits = Omit<ProductSettingRow, 'technology_words'>;

export const SET_LIMITS = {
  ...SET_LIMITS_IDENTITY,
  input: {
    product_id: column('product_setting', 'product_id', 'required'),
    max_children: column('product_setting', 'max_children', 'required'),
    max_entities_per_aggregate: column('product_setting', 'max_entities_per_aggregate', 'required'),
  },
  handler: setLimits,
} satisfies CommandDefinition<SetLimits>;

/** Sets the product's limits, keeping its technology words, and adds its one row (LA-CHK-INV05), with none, the first time. */
export function setLimits(tx: Transaction, input: SetLimits): void {
  const settings = new ProductSettingRepository(tx);
  const setting = settings.load(input.product_id) ?? settings.create({ root: input.product_id, setting: { ...input, technology_words: [] } });
  setting.setting = { ...input, technology_words: setting.setting.technology_words };
  holdToRules(tx, setting);
  settings.save(setting);
}
