// The Product setting aggregate's rules, written once: its command's handler runs them on the settings before it saves
// them, and every load and commit runs them over all data (productSettingRules, listed in AGGREGATE_RULES).
import { beyondFirst, type AggregateRules, type RuleProblem } from '../../platform/data/rules.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { ProductSettingRow } from '../../platform/data/tables.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { PRODUCT_SETTING_AGGREGATE, type ProductSetting } from './model.ts';

/** Every row that breaks LA-CHK-INV05: a product has at most one settings row. Each after the first is refused. */
export function productSettingOne(rows: readonly ProductSettingRow[]): RuleProblem[] {
  return beyondFirst(rows, (r) => r.product_id).map((r) => ({
    rule: 'product-setting-one',
    table: 'product_setting',
    row: r as unknown as Row,
    message: `product ${r.product_id} already has its settings row, so it cannot have a second: a product has one`,
  }));
}

/**
 * Every rule the product's settings break (LA-CHK-INV05 one settings row per product). One instance is one product's
 * one row, so it breaks none on its own; the rule is read over all data.
 */
export function productSettingProblems(setting: ProductSetting): RuleProblem[] {
  return productSettingOne([setting.setting]);
}

/** The rules over all data: every product's settings rows. */
export const productSettingRules: AggregateRules = {
  aggregate: PRODUCT_SETTING_AGGREGATE,
  check: (view) => productSettingOne(view.rows('product_setting') as unknown as ProductSettingRow[]),
};

/** Refuses the command, with every reason, when the settings as they would be saved break one of their rules. */
export function holdToRules(_tx: Transaction, setting: ProductSetting): void {
  const problems = productSettingProblems(setting);
  if (problems.length) throw new StoreError(problems.map((p) => ({ rule: p.rule, table: p.table, message: p.message, command: 0 })));
}
