// The Product setting aggregate (LA-CHK-A2): a product's one settings row, the limits its checks read. One instance is
// one product's settings, whole; a product without them takes the defaults.
import type { Slice } from '../../platform/commands/definition.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { ProductSettingRow } from '../../platform/data/tables.ts';

/** The aggregate's record ID in Lathe's own spec. */
export const PRODUCT_SETTING_AGGREGATE = 'LA-CHK-A2';

/** How the interfaces reach the aggregate's commands: `lathe product-setting`, the product_setting_ tools, /api/product-setting/. */
export const PRODUCT_SETTING_SLICE: Slice = { aggregate: PRODUCT_SETTING_AGGREGATE, name: 'product-setting' };

/** One product's settings, whole. */
export interface ProductSetting {
  /** The product's ID: the instance's root. */
  readonly root: string;
  setting: ProductSettingRow;
}

/** The tables the Product setting aggregate keeps its rows in. */
export const PRODUCT_SETTING_TABLES = ['product_setting'] as const;

/** The products' settings in the data, each whole; only the given product's, when given. */
export function productSettingsFrom(rows: (table: string) => Row[], only?: string): ProductSetting[] {
  return (rows('product_setting') as unknown as ProductSettingRow[]).filter((s) => only === undefined || s.product_id === only).map((setting) => ({ root: setting.product_id, setting }));
}

/** The instance's rows, by table. */
export function productSettingRows(setting: ProductSetting): Map<string, Row[]> {
  return new Map<string, Row[]>([['product_setting', [setting.setting as unknown as Row]]]);
}
