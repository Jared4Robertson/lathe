// Generated from data/ by `npm run generate`. Do not edit.
// ProductSettingRepository (LA-CHK-REPO02): Loads a product's settings row from the transaction's draft and saves it,
// in the product_setting table only.
import { AggregateRepository as Repository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { PRODUCT_SETTING_TABLES, productSettingRows, productSettingsFrom, type ProductSetting } from './model.ts';

export class ProductSettingRepository extends Repository<ProductSetting> {
  constructor(tx: Transaction) {
    super(tx, 'ProductSettingRepository', PRODUCT_SETTING_TABLES);
  }

  protected read(rootId: string): ProductSetting | undefined {
    return productSettingsFrom((table) => this.files.rows(table), rootId)[0];
  }

  protected rowsOf(productSetting: ProductSetting): InstanceRows {
    return productSettingRows(productSetting);
  }
}
