// The Product aggregate's rules, written once: each command's handler runs them on the instance before it saves, and
// every load and commit runs them over all data (productRules, listed in AGGREGATE_RULES). What a product's kinds and
// relations may declare is the schema's to refuse when it builds their tables (platform/data/product-kinds.ts).
import type { AggregateRules, ReadView, RuleProblem } from '../../platform/data/rules.ts';
import type { Row } from '../../platform/data/rows.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { PRODUCT_AGGREGATE, productsFrom, type Product } from './model.ts';

/**
 * Every rule the product breaks (LA-AUT-INV50 an open question's owner is one of its product's roles). The view is
 * not read: every rule holds inside the product.
 */
export function productProblems(product: Product, _view: ReadView): RuleProblem[] {
  const problems: RuleProblem[] = [];
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
    return productsFrom((table) => view.rows(table), productOfDomain).flatMap((product) => productProblems(product, view));
  },
};

/** Refuses the command, with every reason, when the product as it would be saved breaks one of its rules. */
export function holdToRules(tx: Transaction, product: Product): void {
  const problems = productProblems(product, tx);
  if (problems.length) throw new StoreError(problems.map((p) => ({ rule: p.rule, table: p.table, message: p.message, command: 0 })));
}
