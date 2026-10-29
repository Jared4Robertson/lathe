// ProductSettingRepository (LA-CHK-REPO02): loads and saves the Product setting aggregate, one product's settings row,
// in the product_setting table only.
import { AggregateRepository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { PRODUCT_SETTING_TABLES, productSettingRows, productSettingsFrom, type ProductSetting } from './model.ts';

export class ProductSettingRepository extends AggregateRepository<ProductSetting> {
  constructor(tx: Transaction) {
    super(tx, 'ProductSettingRepository', PRODUCT_SETTING_TABLES);
  }

  protected read(productId: string): ProductSetting | undefined {
    return productSettingsFrom((table) => this.files.rows(table), productId)[0];
  }

  protected rowsOf(setting: ProductSetting): InstanceRows {
    return productSettingRows(setting);
  }
}
