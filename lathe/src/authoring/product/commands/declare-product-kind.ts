import { column, parts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { ProductKindRow } from '../../../platform/data/tables.ts';
import { fieldsOf, type FieldInput } from '../model.ts';
import { ProductRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { DECLARE_PRODUCT_KIND_IDENTITY } from './identities.generated.ts';

/** A new product kind: its declaration, and its fields in order. */
export type DeclareProductKind = Pick<ProductKindRow, 'name' | 'product_id' | 'label' | 'description' | 'parent_kind' | 'stage' | 'obligation' | 'id_pattern' | 'id_example' | 'title_form'> & { fields?: FieldInput[] };

export const DECLARE_PRODUCT_KIND: CommandDefinition<DeclareProductKind> = {
  ...DECLARE_PRODUCT_KIND_IDENTITY,
  input: {
    name: column('product_kind', 'name', 'required'),
    product_id: column('product_kind', 'product_id', 'required'),
    label: column('product_kind', 'label', 'required'),
    description: column('product_kind', 'description', 'required'),
    parent_kind: column('product_kind', 'parent_kind', 'required'),
    stage: column('product_kind', 'stage', 'optional'),
    obligation: column('product_kind', 'obligation', 'required'),
    id_pattern: column('product_kind', 'id_pattern', 'optional'),
    id_example: column('product_kind', 'id_example', 'optional'),
    title_form: column('product_kind', 'title_form', 'optional'),
    fields: parts('product_kind_field', ['name', 'type', 'required', 'description'], 'The columns its table adds after id, title and the parent column, in order: each a name, type, whether it is required, and a description.', 'optional'),
  },
  handler: declareProductKind,
};

/** Adds the kind and its fields to the product that declares it. */
export function declareProductKind(tx: Transaction, input: DeclareProductKind): void {
  const products = new ProductRepository(tx);
  const product = products.load(input.product_id) ?? tx.refuse('missing', `there is no product ${input.product_id}`);
  if (products.loadDeclaring(input.name)) tx.refuse('primary-key', `product kind ${input.name} is declared already`);
  const { fields = [], ...row } = input;
  product.kinds.push({ row, fields: fieldsOf(row.name, fields) });
  holdToRules(tx, product);
  products.save(product);
}
