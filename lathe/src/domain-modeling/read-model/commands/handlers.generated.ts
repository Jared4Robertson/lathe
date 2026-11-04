// Generated from data/ by `npm run generate`. Do not edit.
// The read-model commands whose handler is the pattern: load the read model, add, change or remove one record with the
// input's columns and lists, hold it to its rules, and save. Each definition takes its handler from here.
import { changed } from '../../../platform/data/rows.ts';
import { refuseBroken } from '../../../platform/data/rules.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { ReadModelRepository } from '../repository.ts';
import { holdToRules, oneProjection, oneReader } from '../rules.ts';
import type { ChangeReadModel } from './change-read-model.ts';
import type { RemoveReadModel } from './remove-read-model.ts';
import type { AddQuery } from './add-query.ts';
import type { ChangeQuery } from './change-query.ts';
import type { RemoveQuery } from './remove-query.ts';
import type { AddProjection } from './add-projection.ts';
import type { ChangeProjection } from './change-projection.ts';
import type { RemoveProjection } from './remove-projection.ts';
import type { AddQueryHandler } from './add-query-handler.ts';
import type { ChangeQueryHandler } from './change-query-handler.ts';
import type { RemoveQueryHandler } from './remove-query-handler.ts';
import type { AddReader } from './add-reader.ts';
import type { ChangeReader } from './change-reader.ts';
import type { RemoveReader } from './remove-reader.ts';

/** Changes a read model's title or description, its fields (the whole list, in order), or the aggregates it reads, the domain services it calls or the events that feed it (each the whole list). Its domain never changes. */
export function changeReadModel(tx: Transaction, input: ChangeReadModel): void {
  const readModels = new ReadModelRepository(tx);
  const readModel = readModels.load(input.id) ?? tx.refuse('missing', `there is no read model ${input.id}`);
  readModel.readModel = changed(readModel.readModel, input, ['title', 'description']);
  readModel.reads = input.reads ?? readModel.reads;
  readModel.calls = input.calls ?? readModel.calls;
  readModel.fedBy = input.fed_by ?? readModel.fedBy;
  readModel.fields = input.fields ?? readModel.fields;
  holdToRules(tx, readModel);
  readModels.save(readModel);
}

/** Removes a read model whole: its fields, queries with their handlers and its projection, and the links they start. Refused while anything outside it references what is in it, such as its table or a flow step that invokes a query. */
export function removeReadModel(tx: Transaction, input: RemoveReadModel): void {
  const readModels = new ReadModelRepository(tx);
  const readModel = readModels.load(input.id) ?? tx.refuse('missing', `there is no read model ${input.id}`);
  readModels.remove(readModel);
}

/** Adds a query to the read model it reads, with the specifications it selects by and the domain services it calls. */
export function addQuery(tx: Transaction, input: AddQuery): void {
  const readModels = new ReadModelRepository(tx);
  const readModel = readModels.load(input.read_model_id) ?? tx.refuse('missing', `there is no read model ${input.read_model_id}`);
  const { selects_by = [], calls = [], ...row } = input;
  readModel.queries.push({ row, selectsBy: selects_by, calls: calls });
  holdToRules(tx, readModel);
  readModels.save(readModel);
}

/** Changes a query's title or description, or the specifications it selects by or domain services it calls (each the whole list). Its read model never changes. */
export function changeQuery(tx: Transaction, input: ChangeQuery): void {
  const readModels = new ReadModelRepository(tx);
  const readModel = readModels.loadHolding('query', input.id) ?? tx.refuse('missing', `there is no query ${input.id}`);
  readModel.queries = readModel.queries.map((x) => (x.row.id === input.id ? { row: changed(x.row, input, ['title', 'description']), selectsBy: input.selects_by ?? x.selectsBy, calls: input.calls ?? x.calls } : x));
  holdToRules(tx, readModel);
  readModels.save(readModel);
}

/** Removes a query with its handler and the links they start. Refused while anything else references them, such as a flow step that invokes it or its endpoint. */
export function removeQuery(tx: Transaction, input: RemoveQuery): void {
  const readModels = new ReadModelRepository(tx);
  const readModel = readModels.loadHolding('query', input.id) ?? tx.refuse('missing', `there is no query ${input.id}`);
  readModel.queries = readModel.queries.filter((x) => x.row.id !== input.id);
  readModel.queryHandlers = readModel.queryHandlers.filter((x) => x.row.query_id !== input.id);
  readModels.save(readModel);
}

/** Adds the projection that fills a read model, its one piece of code, with the standard rules it meets, the packages it uses and its helper files. */
export function addProjection(tx: Transaction, input: AddProjection): void {
  const readModels = new ReadModelRepository(tx);
  const readModel = readModels.load(input.read_model_id) ?? tx.refuse('missing', `there is no read model ${input.read_model_id}`);
  const { meets = [], packages = [], helpers = [], ...row } = input;
  refuseBroken(oneProjection([...(readModel.projection ? [readModel.projection.row] : []), row]));
  readModel.projection = { row, meets: meets, packages: packages, helpers: helpers };
  holdToRules(tx, readModel);
  readModels.save(readModel);
}

/** Changes a projection's title, file or description, or the standard rules it meets, the packages it uses or its helper files (each the whole list). */
export function changeProjection(tx: Transaction, input: ChangeProjection): void {
  const readModels = new ReadModelRepository(tx);
  const readModel = readModels.loadHolding('projection', input.id) ?? tx.refuse('missing', `there is no projection ${input.id}`);
  const held = readModel.projection!;
  readModel.projection = { row: changed(held.row, input, ['title', 'file', 'description']), meets: input.meets ?? held.meets, packages: input.packages ?? held.packages, helpers: input.helpers ?? held.helpers };
  holdToRules(tx, readModel);
  readModels.save(readModel);
}

/** Removes a read model's projection with the links it starts, the packages it uses and its helper files. Refused while anything references it. */
export function removeProjection(tx: Transaction, input: RemoveProjection): void {
  const readModels = new ReadModelRepository(tx);
  const readModel = readModels.loadHolding('projection', input.id) ?? tx.refuse('missing', `there is no projection ${input.id}`);
  readModel.projection = null;
  readModels.save(readModel);
}

/** Adds the handler that answers a query, its one piece of code, with the standard rules it meets, the packages it uses and its helper files. */
export function addQueryHandler(tx: Transaction, input: AddQueryHandler): void {
  const readModels = new ReadModelRepository(tx);
  const readModel = readModels.loadHolding('query', input.query_id) ?? tx.refuse('missing', `there is no query ${input.query_id}`);
  const { meets = [], packages = [], helpers = [], ...row } = input;
  readModel.queryHandlers.push({ row, meets: meets, packages: packages, helpers: helpers });
  holdToRules(tx, readModel);
  readModels.save(readModel);
}

/** Changes a query handler's title, file or description, or the standard rules it meets, the packages it uses or its helper files (each the whole list). */
export function changeQueryHandler(tx: Transaction, input: ChangeQueryHandler): void {
  const readModels = new ReadModelRepository(tx);
  const readModel = readModels.loadHolding('query_handler', input.id) ?? tx.refuse('missing', `there is no query handler ${input.id}`);
  readModel.queryHandlers = readModel.queryHandlers.map((x) => (x.row.id === input.id ? { row: changed(x.row, input, ['title', 'file', 'description']), meets: input.meets ?? x.meets, packages: input.packages ?? x.packages, helpers: input.helpers ?? x.helpers } : x));
  holdToRules(tx, readModel);
  readModels.save(readModel);
}

/** Removes a query's handler with the links it starts, the packages it uses and its helper files. Refused while anything references it. */
export function removeQueryHandler(tx: Transaction, input: RemoveQueryHandler): void {
  const readModels = new ReadModelRepository(tx);
  const readModel = readModels.loadHolding('query_handler', input.id) ?? tx.refuse('missing', `there is no query handler ${input.id}`);
  readModel.queryHandlers = readModel.queryHandlers.filter((x) => x.row.id !== input.id);
  readModels.save(readModel);
}

/** Adds a read model's reader, the one way its query handlers read its table, with the data store it reads the table in, the standard rules it meets, the packages it uses and its helper files. */
export function addReader(tx: Transaction, input: AddReader): void {
  const readModels = new ReadModelRepository(tx);
  const readModel = readModels.load(input.read_model_id) ?? tx.refuse('missing', `there is no read model ${input.read_model_id}`);
  const { stored_in, meets = [], packages = [], helpers = [], ...row } = input;
  refuseBroken(oneReader([...(readModel.reader ? [readModel.reader.row] : []), row]));
  readModel.reader = { row, meets: meets, packages: packages, helpers: helpers, storedIn: stored_in ?? null };
  holdToRules(tx, readModel);
  readModels.save(readModel);
}

/** Changes a reader's title, file or description, the data store it reads in (null clears it), or the standard rules it meets, the packages it uses or its helper files (each the whole list). */
export function changeReader(tx: Transaction, input: ChangeReader): void {
  const readModels = new ReadModelRepository(tx);
  const readModel = readModels.loadHolding('reader', input.id) ?? tx.refuse('missing', `there is no reader ${input.id}`);
  const held = readModel.reader!;
  readModel.reader = { row: changed(held.row, input, ['title', 'file', 'description']), meets: input.meets ?? held.meets, packages: input.packages ?? held.packages, helpers: input.helpers ?? held.helpers, storedIn: input.stored_in === undefined ? held.storedIn : input.stored_in };
  holdToRules(tx, readModel);
  readModels.save(readModel);
}

/** Removes a read model's reader with the links it starts, the packages it uses and its helper files. Refused while anything references it. */
export function removeReader(tx: Transaction, input: RemoveReader): void {
  const readModels = new ReadModelRepository(tx);
  const readModel = readModels.loadHolding('reader', input.id) ?? tx.refuse('missing', `there is no reader ${input.id}`);
  readModel.reader = null;
  readModels.save(readModel);
}
