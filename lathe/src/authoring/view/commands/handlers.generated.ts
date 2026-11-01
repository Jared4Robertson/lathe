// Generated from data/ by `npm run generate`. Do not edit.
// The view commands whose handler is the pattern: load the view, add, change or remove one record with the
// input's columns and lists, hold it to its rules, and save. Each definition takes its handler from here.
import { changed } from '../../../platform/data/rows.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { ViewRepository } from '../repository.ts';
import type { AddView } from './add-view.ts';
import type { ChangeView } from './change-view.ts';
import type { RemoveView } from './remove-view.ts';
import type { AddViewRequirement } from './add-view-requirement.ts';
import type { ChangeViewRequirement } from './change-view-requirement.ts';
import type { RemoveViewRequirement } from './remove-view-requirement.ts';
import type { AddViewTest } from './add-view-test.ts';
import type { ChangeViewTest } from './change-view-test.ts';
import type { RemoveViewTest } from './remove-view-test.ts';

/** Adds a view: a screen or page a person uses, with its route, the one interface that shows it if only one does, and the commands and queries it presents. It has no owner; its product follows from its ID. */
export function addView(tx: Transaction, input: AddView): void {
  const views = new ViewRepository(tx);
  const { presents = [], ...row } = input;
  const view = views.create({ root: row.id, view: row, presents: presents, requirements: [], tests: [] });
  views.save(view);
}

/** Changes a view's title, route, interface, description or notes, or what it presents (the whole list). */
export function changeView(tx: Transaction, input: ChangeView): void {
  const views = new ViewRepository(tx);
  const view = views.load(input.id) ?? tx.refuse('missing', `there is no view ${input.id}`);
  view.view = changed(view.view, input, ['title', 'description', 'route', 'interface_id', 'notes']);
  view.presents = input.presents ?? view.presents;
  views.save(view);
}

/** Removes a view whole: its view requirements and their view tests and the links they start. Refused while anything outside it references what is in it. */
export function removeView(tx: Transaction, input: RemoveView): void {
  const views = new ViewRepository(tx);
  const view = views.load(input.id) ?? tx.refuse('missing', `there is no view ${input.id}`);
  views.remove(view);
}

/** Adds a view requirement under its view: one rule the view must follow. */
export function addViewRequirement(tx: Transaction, input: AddViewRequirement): void {
  const views = new ViewRepository(tx);
  const view = views.load(input.view_id) ?? tx.refuse('missing', `there is no view ${input.view_id}`);
  view.requirements.push(input);
  views.save(view);
}

/** Changes a view requirement's title, statement or group. Its view does not change. */
export function changeViewRequirement(tx: Transaction, input: ChangeViewRequirement): void {
  const views = new ViewRepository(tx);
  const view = views.loadHolding('view_requirement', input.id) ?? tx.refuse('missing', `there is no view requirement ${input.id}`);
  view.requirements = view.requirements.map((x) => (x.id === input.id ? changed(x, input, ['title', 'statement', 'group_name']) : x));
  views.save(view);
}

/** Removes a view requirement with its view tests and the links they start. Refused while anything else references them. */
export function removeViewRequirement(tx: Transaction, input: RemoveViewRequirement): void {
  const views = new ViewRepository(tx);
  const view = views.loadHolding('view_requirement', input.id) ?? tx.refuse('missing', `there is no view requirement ${input.id}`);
  view.requirements = view.requirements.filter((x) => x.id !== input.id);
  view.tests = view.tests.filter((x) => x.row.view_requirement_id !== input.id);
  views.save(view);
}

/** Adds a view test under its view requirement, with the test data sets it starts from. */
export function addViewTest(tx: Transaction, input: AddViewTest): void {
  const views = new ViewRepository(tx);
  const view = views.loadHolding('view_requirement', input.view_requirement_id) ?? tx.refuse('missing', `there is no view requirement ${input.view_requirement_id}`);
  const { starts_from = [], ...row } = input;
  view.tests.push({ row, startsFrom: starts_from });
  views.save(view);
}

/** Changes a view test's columns or the test data sets it starts from (the whole list). Its requirement does not change. */
export function changeViewTest(tx: Transaction, input: ChangeViewTest): void {
  const views = new ViewRepository(tx);
  const view = views.loadHolding('view_test', input.id) ?? tx.refuse('missing', `there is no view test ${input.id}`);
  view.tests = view.tests.map((x) => (x.row.id === input.id ? { row: changed(x.row, input, ['title', 'level', 'state', 'when', 'then', 'file', 'manual_reason', 'size', 'smoke', 'external', 'notes']), startsFrom: input.starts_from ?? x.startsFrom } : x));
  views.save(view);
}

/** Removes a view test with the links it starts. Refused while anything else references them. */
export function removeViewTest(tx: Transaction, input: RemoveViewTest): void {
  const views = new ViewRepository(tx);
  const view = views.loadHolding('view_test', input.id) ?? tx.refuse('missing', `there is no view test ${input.id}`);
  view.tests = view.tests.filter((x) => x.row.id !== input.id);
  views.save(view);
}
