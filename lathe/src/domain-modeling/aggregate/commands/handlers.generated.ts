// Generated from data/ by `npm run generate`. Do not edit.
// The aggregate commands whose handler is the pattern: load the aggregate, add, change or remove one record with the
// input's columns and lists, hold it to its rules, and save. Each definition takes its handler from here.
import { changed } from '../../../platform/data/rows.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { AggregateRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import type { AddAggregate } from './add-aggregate.ts';
import type { ChangeAggregate } from './change-aggregate.ts';
import type { RemoveAggregate } from './remove-aggregate.ts';
import type { AddEntity } from './add-entity.ts';
import type { ChangeEntity } from './change-entity.ts';
import type { RemoveEntity } from './remove-entity.ts';
import type { AddInvariant } from './add-invariant.ts';
import type { ChangeInvariant } from './change-invariant.ts';
import type { RemoveInvariant } from './remove-invariant.ts';
import type { AddDataModel } from './add-data-model.ts';
import type { ChangeDataModel } from './change-data-model.ts';
import type { RemoveDataModel } from './remove-data-model.ts';
import type { AddInvariantTest } from './add-invariant-test.ts';
import type { ChangeInvariantTest } from './change-invariant-test.ts';
import type { RemoveInvariantTest } from './remove-invariant-test.ts';
import type { AddRule } from './add-rule.ts';
import type { ChangeRule } from './change-rule.ts';
import type { RemoveRule } from './remove-rule.ts';

/** Adds an aggregate under a domain, with nothing in it yet. */
export function addAggregate(tx: Transaction, input: AddAggregate): void {
  const aggregates = new AggregateRepository(tx);
  if (tx.record(input.domain_id)?.kind !== 'domain') tx.refuse('missing', `there is no domain ${input.domain_id}`);
  const aggregate = aggregates.create({ root: input.id, aggregate: input, entities: [], invariants: [], dataModels: [], rules: [], invariantTests: [] });
  holdToRules(tx, aggregate);
  aggregates.save(aggregate);
}

/** Changes an aggregate's title, description, identity or notes. Its domain does not change. */
export function changeAggregate(tx: Transaction, input: ChangeAggregate): void {
  const aggregates = new AggregateRepository(tx);
  const aggregate = aggregates.load(input.id) ?? tx.refuse('missing', `there is no aggregate ${input.id}`);
  aggregate.aggregate = changed(aggregate.aggregate, input, ['title', 'description', 'identity', 'notes']);
  holdToRules(tx, aggregate);
  aggregates.save(aggregate);
}

/** Removes an aggregate whole: its entities and their fields, data models, invariants with their rules, tests and the links they start. Refused while anything outside it references what is in it. */
export function removeAggregate(tx: Transaction, input: RemoveAggregate): void {
  const aggregates = new AggregateRepository(tx);
  const aggregate = aggregates.load(input.id) ?? tx.refuse('missing', `there is no aggregate ${input.id}`);
  aggregates.remove(aggregate);
}

/** Adds an entity to its aggregate, as its root or a child, with its fields in order and the entities of its aggregate it holds. */
export function addEntity(tx: Transaction, input: AddEntity): void {
  const aggregates = new AggregateRepository(tx);
  const aggregate = aggregates.load(input.aggregate_id) ?? tx.refuse('missing', `there is no aggregate ${input.aggregate_id}`);
  const { fields = [], has_one = [], has_many = [], ...row } = input;
  aggregate.entities.push({ row, fields: fields.map((item, at) => ({ entity_id: row.id, position: at + 1, ...item })), hasOne: has_one, hasMany: has_many });
  holdToRules(tx, aggregate);
  aggregates.save(aggregate);
}

/** Changes an entity's title, role, description or whether it is stored in its root's table, or its fields (the whole list, in order) or the entities it holds (each list whole). Its aggregate does not change. */
export function changeEntity(tx: Transaction, input: ChangeEntity): void {
  const aggregates = new AggregateRepository(tx);
  const aggregate = aggregates.loadHolding('entity', input.id) ?? tx.refuse('missing', `there is no entity ${input.id}`);
  aggregate.entities = aggregate.entities.map((x) => (x.row.id === input.id ? { row: changed(x.row, input, ['title', 'role', 'in_root_table', 'description']), fields: input.fields ? input.fields.map((item, at) => ({ entity_id: input.id, position: at + 1, ...item })) : x.fields, hasOne: input.has_one ?? x.hasOne, hasMany: input.has_many ?? x.hasMany } : x));
  holdToRules(tx, aggregate);
  aggregates.save(aggregate);
}

/** Removes an entity with its fields, its data model and the links they start. Refused while anything else references them: a command under it, its table, or another entity that holds it. */
export function removeEntity(tx: Transaction, input: RemoveEntity): void {
  const aggregates = new AggregateRepository(tx);
  const aggregate = aggregates.loadHolding('entity', input.id) ?? tx.refuse('missing', `there is no entity ${input.id}`);
  aggregate.entities = aggregate.entities.filter((x) => x.row.id !== input.id);
  aggregate.dataModels = aggregate.dataModels.filter((x) => x.row.entity_id !== input.id);
  aggregates.save(aggregate);
}

/** Adds an invariant to its aggregate: a rule that holds on every change. */
export function addInvariant(tx: Transaction, input: AddInvariant): void {
  const aggregates = new AggregateRepository(tx);
  const aggregate = aggregates.load(input.aggregate_id) ?? tx.refuse('missing', `there is no aggregate ${input.aggregate_id}`);
  aggregate.invariants.push(input);
  holdToRules(tx, aggregate);
  aggregates.save(aggregate);
}

/** Changes an invariant's title or statement. Its aggregate does not change. */
export function changeInvariant(tx: Transaction, input: ChangeInvariant): void {
  const aggregates = new AggregateRepository(tx);
  const aggregate = aggregates.loadHolding('invariant', input.id) ?? tx.refuse('missing', `there is no invariant ${input.id}`);
  aggregate.invariants = aggregate.invariants.map((x) => (x.id === input.id ? changed(x, input, ['title', 'statement']) : x));
  holdToRules(tx, aggregate);
  aggregates.save(aggregate);
}

/** Removes an invariant with its rule and its test, and the links they start. Refused while anything else references them, such as a table key it names. */
export function removeInvariant(tx: Transaction, input: RemoveInvariant): void {
  const aggregates = new AggregateRepository(tx);
  const aggregate = aggregates.loadHolding('invariant', input.id) ?? tx.refuse('missing', `there is no invariant ${input.id}`);
  aggregate.invariants = aggregate.invariants.filter((x) => x.id !== input.id);
  aggregate.rules = aggregate.rules.filter((x) => x.row.invariant_id !== input.id);
  aggregate.invariantTests = aggregate.invariantTests.filter((x) => x.row.invariant_id !== input.id);
  aggregates.save(aggregate);
}

/** Adds the data model of an entity of the aggregate: its name in code and its file, with the standard rules it meets, the packages it uses and its helper files. */
export function addDataModel(tx: Transaction, input: AddDataModel): void {
  const aggregates = new AggregateRepository(tx);
  const aggregate = aggregates.loadHolding('entity', input.entity_id) ?? tx.refuse('missing', `there is no entity ${input.entity_id}`);
  const { meets = [], packages = [], helpers = [], ...row } = input;
  aggregate.dataModels.push({ row, meets: meets, packages: packages, helpers: helpers });
  holdToRules(tx, aggregate);
  aggregates.save(aggregate);
}

/** Changes a data model's title or file, or the standard rules it meets, the packages it uses or its helper files (each list whole). Its entity does not change. */
export function changeDataModel(tx: Transaction, input: ChangeDataModel): void {
  const aggregates = new AggregateRepository(tx);
  const aggregate = aggregates.loadHolding('data_model', input.id) ?? tx.refuse('missing', `there is no data model ${input.id}`);
  aggregate.dataModels = aggregate.dataModels.map((x) => (x.row.id === input.id ? { row: changed(x.row, input, ['title', 'file']), meets: input.meets ?? x.meets, packages: input.packages ?? x.packages, helpers: input.helpers ?? x.helpers } : x));
  holdToRules(tx, aggregate);
  aggregates.save(aggregate);
}

/** Removes a data model with the links it starts, the packages it uses and its helper files. Refused while anything else references it. */
export function removeDataModel(tx: Transaction, input: RemoveDataModel): void {
  const aggregates = new AggregateRepository(tx);
  const aggregate = aggregates.loadHolding('data_model', input.id) ?? tx.refuse('missing', `there is no data model ${input.id}`);
  aggregate.dataModels = aggregate.dataModels.filter((x) => x.row.id !== input.id);
  aggregates.save(aggregate);
}

/** Adds the test of an invariant, with the test data sets it starts from. */
export function addInvariantTest(tx: Transaction, input: AddInvariantTest): void {
  const aggregates = new AggregateRepository(tx);
  const aggregate = aggregates.loadHolding('invariant', input.invariant_id) ?? tx.refuse('missing', `there is no invariant ${input.invariant_id}`);
  const { starts_from = [], ...row } = input;
  aggregate.invariantTests.push({ row, startsFrom: starts_from });
  holdToRules(tx, aggregate);
  aggregates.save(aggregate);
}

/** Changes what an invariant test says, or the test data sets it starts from (the whole list). */
export function changeInvariantTest(tx: Transaction, input: ChangeInvariantTest): void {
  const aggregates = new AggregateRepository(tx);
  const aggregate = aggregates.loadHolding('invariant_test', input.id) ?? tx.refuse('missing', `there is no invariant test ${input.id}`);
  aggregate.invariantTests = aggregate.invariantTests.map((x) => (x.row.id === input.id ? { row: changed(x.row, input, ['title', 'level', 'state', 'file', 'manual_reason', 'size', 'smoke', 'external', 'when', 'then', 'notes']), startsFrom: input.starts_from ?? x.startsFrom } : x));
  holdToRules(tx, aggregate);
  aggregates.save(aggregate);
}

/** Removes an invariant test with the links it starts. Refused while anything else references it, such as a business outcome it measures. */
export function removeInvariantTest(tx: Transaction, input: RemoveInvariantTest): void {
  const aggregates = new AggregateRepository(tx);
  const aggregate = aggregates.loadHolding('invariant_test', input.id) ?? tx.refuse('missing', `there is no invariant test ${input.id}`);
  aggregate.invariantTests = aggregate.invariantTests.filter((x) => x.row.id !== input.id);
  aggregates.save(aggregate);
}

/** Adds the rule that enforces an invariant of the aggregate: its name in code, the name its refusal carries, and its file, with the standard rules it meets, the packages it uses and its helper files. */
export function addRule(tx: Transaction, input: AddRule): void {
  const aggregates = new AggregateRepository(tx);
  const aggregate = aggregates.loadHolding('invariant', input.invariant_id) ?? tx.refuse('missing', `there is no invariant ${input.invariant_id}`);
  const { meets = [], packages = [], helpers = [], ...row } = input;
  aggregate.rules.push({ row, meets: meets, packages: packages, helpers: helpers });
  holdToRules(tx, aggregate);
  aggregates.save(aggregate);
}

/** Changes a rule's title or file, or the standard rules it meets, the packages it uses or its helper files (each list whole). Its invariant does not change. */
export function changeRule(tx: Transaction, input: ChangeRule): void {
  const aggregates = new AggregateRepository(tx);
  const aggregate = aggregates.loadHolding('rule', input.id) ?? tx.refuse('missing', `there is no rule ${input.id}`);
  aggregate.rules = aggregate.rules.map((x) => (x.row.id === input.id ? { row: changed(x.row, input, ['title', 'file']), meets: input.meets ?? x.meets, packages: input.packages ?? x.packages, helpers: input.helpers ?? x.helpers } : x));
  holdToRules(tx, aggregate);
  aggregates.save(aggregate);
}

/** Removes a rule with the links it starts, the packages it uses and its helper files, so its invariant is no longer built. Refused while anything else references it. */
export function removeRule(tx: Transaction, input: RemoveRule): void {
  const aggregates = new AggregateRepository(tx);
  const aggregate = aggregates.loadHolding('rule', input.id) ?? tx.refuse('missing', `there is no rule ${input.id}`);
  aggregate.rules = aggregate.rules.filter((x) => x.row.id !== input.id);
  aggregates.save(aggregate);
}
