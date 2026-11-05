import { column, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { ProductSettingRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { DEFAULT_LIMITS } from '../model.ts';
import { SET_TECHNOLOGY_WORDS_IDENTITY } from './identities.generated.ts';

/** The product and the words that name technology in it. */
export type SetTechnologyWords = { product_id: string; technology_words: string[] };

export const SET_TECHNOLOGY_WORDS = {
  ...SET_TECHNOLOGY_WORDS_IDENTITY,
  input: {
    product_id: column('product_setting', 'product_id', 'required'),
    technology_words: texts("The words, besides Lathe's own, that name technology in the product's essential records. Replaces the list.", 'required'),
  },
  handler: setTechnologyWords,
} satisfies CommandDefinition<SetTechnologyWords>;

/** Sets the product's technology words, keeping its limits and strictness, and adds its one row (LA-CHK-INV05), with the default limits, the first time. */
export function setTechnologyWords(tx: Transaction, input: SetTechnologyWords): void {
  const settings = new ProductSettingRepository(tx);
  const words = [...new Set(input.technology_words.map((w) => w.trim()).filter(Boolean))].sort();
  const setting = settings.load(input.product_id) ?? settings.create({ root: input.product_id, setting: { product_id: input.product_id, ...DEFAULT_LIMITS, technology_words: words } });
  setting.setting = { ...setting.setting, technology_words: words };
  holdToRules(tx, setting);
  settings.save(setting);
}
