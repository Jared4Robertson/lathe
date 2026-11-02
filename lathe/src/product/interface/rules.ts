// The Interface aggregate's rules, written once: each command's handler runs them on the instance before it saves,
// and every load and commit runs them over all data (interfaceRules, listed in AGGREGATE_RULES).
import type { AggregateRules, ReadView, RuleProblem } from '../../platform/data/rules.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { rolesNotOfProduct } from '../product/rules.ts';
import { INTERFACE_AGGREGATE, interfacesFrom, type Interface } from './model.ts';

/** Every rule the interface breaks (LA-PRD-INV194 each role that uses it is one of its product's roles). */
export function interfaceProblems(iface: Interface, view: ReadView): RuleProblem[] {
  const actors = iface.actors.map((role, at) => ({ interface_id: iface.root, position: at + 1, role_name: role }));
  return rolesNotOfProduct(view, 'interface_actor', `Interface ${iface.root}`, iface.row.product_id, actors, 'as a role that uses it').map((p) => ({ rule: 'interface-actor-role', ...p }));
}

/** The rules over all data: every interface, whole. */
export const interfaceRules: AggregateRules = {
  aggregate: INTERFACE_AGGREGATE,
  check: (view) => interfacesFrom((table) => view.rows(table)).flatMap((iface) => interfaceProblems(iface, view)),
};

/** Refuses the command, with every reason, when the interface as it would be saved breaks one of its rules. */
export function holdToRules(tx: Transaction, iface: Interface): void {
  const problems = interfaceProblems(iface, tx);
  if (problems.length) throw new StoreError(problems.map((p) => ({ rule: p.rule, table: p.table, message: p.message })));
}
