import { column, parts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { ProductKindRow } from '../../../platform/data/tables.ts';
import { PRODUCT_SLICE, changed, fieldsOf, type FieldInput } from '../model.ts';
import { ProductRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

/** The kind's changes: a column given is set, null clears an optional one; fields, when given, replace the list. */
export type ChangeProductKind = Pick<ProductKindRow, 'name'> & { label?: string; description?: string; parent_kind?: string; stage?: ProductKindRow['stage'] | null; obligation?: boolean; id_pattern?: string | null; id_example?: string | null; title_form?: ProductKindRow['title_form'] | null; fields?: FieldInput[] };

export const CHANGE_PRODUCT_KIND: CommandDefinition<ChangeProductKind> = {
  id: 'LA-AUT-CMD123',
  slice: PRODUCT_SLICE,
  name: 'change-product-kind',
  description: "Changes a product kind's label, description, parent kind, stage, obligation, ID pattern, example or title form, or its fields (the whole list, in order). Refused when a record of the kind no longer fits it.",
  method: 'POST',
  route: '/api/product/change-product-kind',
  input: {
    name: column('product_kind', 'name', 'required'),
    label: column('product_kind', 'label', 'optional'),
    description: column('product_kind', 'description', 'optional'),
    parent_kind: column('product_kind', 'parent_kind', 'optional'),
    stage: column('product_kind', 'stage', 'clearable'),
    obligation: column('product_kind', 'obligation', 'optional'),
    id_pattern: column('product_kind', 'id_pattern', 'clearable'),
    id_example: column('product_kind', 'id_example', 'clearable'),
    title_form: column('product_kind', 'title_form', 'clearable'),
    fields: parts('product_kind_field', ['name', 'type', 'required', 'description'], 'The columns its table adds, in order. Replaces the list.', 'optional'),
  },
  handler: changeProductKind,
};

/** Changes the kind's declaration and fields. */
export function changeProductKind(tx: Transaction, input: ChangeProductKind): void {
  const products = new ProductRepository(tx);
  const product = products.loadDeclaring(input.name) ?? tx.refuse('missing', `there is no product kind ${input.name}`);
  product.kinds = product.kinds.map((kind) =>
    kind.row.name !== input.name
      ? kind
      : { row: changed(kind.row, input, ['label', 'description', 'parent_kind', 'stage', 'obligation', 'id_pattern', 'id_example', 'title_form']), fields: input.fields ? fieldsOf(kind.row.name, input.fields) : kind.fields },
  );
  holdToRules(tx, product);
  products.save(product);
}
