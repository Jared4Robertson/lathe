// The Product aggregate's rules, written once: each command's handler runs them on the instance before it saves, and
// every load and commit runs them over all data (productRules, listed in AGGREGATE_RULES). A product's kinds and
// relations are held to them before the schema builds their tables (platform/data/product-kinds.ts).
import type { AggregateRules, ReadView, RuleProblem } from '../../platform/data/rules.ts';
import type { Row } from '../../platform/data/rows.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import type { ProductRelationRow } from '../../platform/data/tables.ts';
import { PRODUCT_AGGREGATE, productsFrom, type Product } from './model.ts';

/** Whether the text is missing or blank. */
const blank = (text: unknown) => typeof text !== 'string' || text.trim() === '';

/**
 * Every declaration of the product that breaks LA-AUT-INV22 (a product kind is declared once, by a name no Lathe table
 * has, under a kind that exists, never in a circle) or LA-AUT-INV23 (a product relation with a new name gets a link
 * table of its own and gives every pair the same role and labels; one with Lathe's name only adds a pair its link
 * table's ends accept; every relation links kinds and has both its labels). The view gives Lathe's schema and the
 * other products' declarations.
 */
function declarationProblems(product: Product, view: ReadView): RuleProblem[] {
  const problems: RuleProblem[] = [];
  const { schema } = view;
  const lathes = (name: string) => name in schema.tables && (schema.kinds[name]?.productId ?? schema.relations[name]?.productId ?? null) === null;
  const own = new Map(product.kinds.map((k) => [k.row.name, k.row]));
  const elsewhere = new Map(view.rows('product_kind').filter((k) => k.product_id !== product.root).map((k) => [String(k.name), String(k.product_id)]));
  const isKind = (name: string) => own.has(name) || (name in schema.kinds && schema.kinds[name].productId === null);
  const kind = (row: object, message: string) => problems.push({ rule: 'product-kind-declared', table: 'product_kind', row: row as unknown as Row, message });
  const seen = new Set<string>();
  for (const { row } of product.kinds) {
    if (seen.has(row.name)) kind(row, `The product kind ${row.name} is declared twice by ${product.root}; declare it once.`);
    seen.add(row.name);
    if (elsewhere.has(row.name)) kind(row, `The product kind ${row.name} is declared already, by ${elsewhere.get(row.name)}; give it another name.`);
    else if (lathes(row.name)) kind(row, `The product kind ${row.name} has the name of a table Lathe already has; give it another name.`);
    else if (!isKind(row.parent_kind) || row.parent_kind === row.name) kind(row, `The product kind ${row.name} sits under ${row.parent_kind}, which is not a kind.`);
    else {
      const trail = [row.name];
      for (let up = own.get(row.parent_kind); up; up = own.get(up.parent_kind)) {
        if (trail.includes(up.name)) {
          kind(row, `Product kinds sit under each other in a circle: ${[...trail, up.name].join(' -> ')}.`);
          break;
        }
        trail.push(up.name);
      }
    }
  }
  const relation = (row: object, message: string) => problems.push({ rule: 'product-relation-own', table: 'product_relation', row: row as unknown as Row, message });
  const firstOf = new Map<string, ProductRelationRow>();
  for (const pair of product.relations) {
    if (blank(pair.forward_label) || blank(pair.reverse_label)) relation(pair, `The relation ${pair.name} needs both its labels, forward and reverse.`);
    if (!isKind(pair.source_kind) || (pair.target_kind !== '*' && !isKind(pair.target_kind))) {
      relation(pair, `The relation ${pair.name} links ${pair.source_kind} to ${pair.target_kind}, and one of them is not a kind.`);
      continue;
    }
    const existing = schema.relations[pair.name];
    if (existing && existing.productId === null) {
      const fits = (table: string, end: string) =>
        table === 'record_id' || table === end || (schema.supertypes[table]?.includes(end) ?? false) || (table === 'obligation' && own.get(end)?.obligation === true);
      if (!fits(existing.sourceTable, pair.source_kind) || !fits(existing.targetTable, pair.target_kind)) {
        relation(pair, `Lathe's relation ${pair.name} links ${existing.sourceTable} to ${existing.targetTable}, so it cannot link ${pair.source_kind} to ${pair.target_kind}; give the relation a name of its own.`);
      }
      continue;
    }
    if (lathes(pair.name)) {
      relation(pair, `The relation ${pair.name} has the name of a table Lathe already has; give it another name.`);
      continue;
    }
    const first = firstOf.get(pair.name);
    if (!first) firstOf.set(pair.name, pair);
    else if (pair.role !== first.role || pair.forward_label !== first.forward_label || pair.reverse_label !== first.reverse_label) {
      relation(pair, `The pairs of the relation ${pair.name} give it different roles or labels; give every pair the same.`);
    }
  }
  return problems;
}

/**
 * Every declaration of the product without its description (LA-AUT-INV24): a product kind, a kind field and a product
 * relation each describe themselves, so the reference never shows a blank.
 */
function undescribed(product: Product): RuleProblem[] {
  const problems: RuleProblem[] = [];
  const missing = (table: string, row: object, what: string) =>
    problems.push({ rule: 'product-declaration-described', table, row: row as unknown as Row, message: `${what} of ${product.root} has no description; describe it, so the reference never shows a blank` });
  for (const { row, fields } of product.kinds) {
    if (blank(row.description)) missing('product_kind', row, `The product kind ${row.name}`);
    for (const field of fields) if (blank(field.description)) missing('product_kind_field', field, `The field ${field.name} of ${row.name}`);
  }
  for (const pair of product.relations) if (blank(pair.description)) missing('product_relation', pair, `The relation ${pair.name} from ${pair.source_kind} to ${pair.target_kind}`);
  return problems;
}

/**
 * Every rule the product breaks (LA-AUT-INV50 an open question's owner is one of its product's roles; LA-AUT-INV22 and
 * INV23 its declarations, as declarationProblems says; LA-AUT-INV24 each is described). The view gives Lathe's schema
 * and the other products' declarations.
 */
export function productProblems(product: Product, view: ReadView): RuleProblem[] {
  const problems: RuleProblem[] = [...declarationProblems(product, view), ...undescribed(product)];
  const roles = new Set(product.roles.map((r) => r.name));
  for (const question of product.questions) {
    if (roles.has(question.row.owner)) continue;
    problems.push({
      rule: 'question-owner-role',
      table: 'question',
      row: question.row as unknown as Row,
      message: `${question.row.id} is owned by ${question.row.owner}, which is not a role of ${product.root}; its roles are ${[...roles].sort().join(', ') || 'none'}`,
    });
  }
  return problems;
}

/** The rules over all data: every product, whole. */
export const productRules: AggregateRules = {
  aggregate: PRODUCT_AGGREGATE,
  check: (view) => {
    const productOfDomain = (domain: string) => {
      const record = view.record(domain);
      return record?.kind === 'domain' ? String(record.row.product_id) : undefined;
    };
    const declared = new Set(view.rows('product_kind').map((k) => String(k.name)));
    // A kind field of no product kind sits in no product's instance: it would widen one of Lathe's kinds (LA-AUT-INV22).
    const widening: RuleProblem[] = view
      .rows('product_kind_field')
      .filter((f) => !declared.has(String(f.kind)))
      .map((f) => ({ rule: 'product-kind-declared', table: 'product_kind_field', row: f, message: `The field ${String(f.name)} is of ${String(f.kind)}, which is not a product kind.` }));
    return [...productsFrom((table) => view.rows(table), productOfDomain).flatMap((product) => productProblems(product, view)), ...widening];
  },
};

/** Refuses the command, with every reason, when the product as it would be saved breaks one of its rules. */
export function holdToRules(tx: Transaction, product: Product): void {
  const problems = productProblems(product, tx);
  if (problems.length) throw new StoreError(problems.map((p) => ({ rule: p.rule, table: p.table, message: p.message })));
}
