// Generated from data/ by `npm run generate`. Do not edit.
// The journey commands whose handler is the pattern: load the journey, add, change or remove one record with the
// input's columns and lists, hold it to its rules, and save. Each definition takes its handler from here.
import { changed } from '../../../platform/data/rows.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { JourneyRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import type { AddJourney } from './add-journey.ts';
import type { ChangeJourney } from './change-journey.ts';
import type { RemoveJourney } from './remove-journey.ts';
import type { AddJourneyStep } from './add-journey-step.ts';
import type { ChangeJourneyStep } from './change-journey-step.ts';
import type { RemoveJourneyStep } from './remove-journey-step.ts';
import type { AddJourneyTest } from './add-journey-test.ts';
import type { ChangeJourneyTest } from './change-journey-test.ts';
import type { RemoveJourneyTest } from './remove-journey-test.ts';

/** Adds a journey under its product, with its trigger, its result and the business outcomes it serves. */
export function addJourney(tx: Transaction, input: AddJourney): void {
  const journeys = new JourneyRepository(tx);
  const { serves = [], ...row } = input;
  const journey = journeys.create({ root: row.id, journey: row, serves: serves, steps: [], tests: [] });
  holdToRules(tx, journey);
  journeys.save(journey);
}

/** Changes a journey's title, trigger, result or notes, or the business outcomes it serves (the whole list). Its product stays. */
export function changeJourney(tx: Transaction, input: ChangeJourney): void {
  const journeys = new JourneyRepository(tx);
  const journey = journeys.load(input.id) ?? tx.refuse('missing', `there is no journey ${input.id}`);
  journey.journey = changed(journey.journey, input, ['title', 'trigger', 'result', 'notes']);
  journey.serves = input.serves ?? journey.serves;
  holdToRules(tx, journey);
  journeys.save(journey);
}

/** Removes a journey whole: its steps, its journey test and the links they start, never the use cases and policies its steps carry out. Refused while anything outside it references what is in it. */
export function removeJourney(tx: Transaction, input: RemoveJourney): void {
  const journeys = new JourneyRepository(tx);
  const journey = journeys.load(input.id) ?? tx.refuse('missing', `there is no journey ${input.id}`);
  journeys.remove(journey);
}

/** Adds a step to its journey, on a path at a position, with the use case or policy it carries out, or none yet. */
export function addJourneyStep(tx: Transaction, input: AddJourneyStep): void {
  const journeys = new JourneyRepository(tx);
  const journey = journeys.load(input.journey_id) ?? tx.refuse('missing', `there is no journey ${input.journey_id}`);
  const { carries_out, ...row } = input;
  journey.steps.push({ row, carriesOut: carries_out ?? null });
  holdToRules(tx, journey);
  journeys.save(journey);
}

/** Changes a step's title, or the use case or policy it carries out (null clears it). Its path and position change only by Move a journey step. */
export function changeJourneyStep(tx: Transaction, input: ChangeJourneyStep): void {
  const journeys = new JourneyRepository(tx);
  const journey = journeys.loadHolding('journey_step', input.id) ?? tx.refuse('missing', `there is no journey step ${input.id}`);
  journey.steps = journey.steps.map((x) => (x.row.id === input.id ? { row: changed(x.row, input, ['title']), carriesOut: input.carries_out === undefined ? x.carriesOut : input.carries_out } : x));
  holdToRules(tx, journey);
  journeys.save(journey);
}

/** Removes a step with the link it starts. Refused while anything else references it. */
export function removeJourneyStep(tx: Transaction, input: RemoveJourneyStep): void {
  const journeys = new JourneyRepository(tx);
  const journey = journeys.loadHolding('journey_step', input.id) ?? tx.refuse('missing', `there is no journey step ${input.id}`);
  journey.steps = journey.steps.filter((x) => x.row.id !== input.id);
  journeys.save(journey);
}

/** Adds the journey test under its journey, with the test data sets it starts from. */
export function addJourneyTest(tx: Transaction, input: AddJourneyTest): void {
  const journeys = new JourneyRepository(tx);
  const journey = journeys.load(input.journey_id) ?? tx.refuse('missing', `there is no journey ${input.journey_id}`);
  const { starts_from = [], ...row } = input;
  journey.tests.push({ row, startsFrom: starts_from });
  holdToRules(tx, journey);
  journeys.save(journey);
}

/** Changes a journey test's way of running, steps or expected result, or the test data sets it starts from (the whole list). */
export function changeJourneyTest(tx: Transaction, input: ChangeJourneyTest): void {
  const journeys = new JourneyRepository(tx);
  const journey = journeys.loadHolding('journey_test', input.id) ?? tx.refuse('missing', `there is no journey test ${input.id}`);
  journey.tests = journey.tests.map((x) => (x.row.id === input.id ? { row: changed(x.row, input, ['title', 'level', 'state', 'file', 'manual_reason', 'size', 'smoke', 'external', 'steps', 'expected_result', 'notes']), startsFrom: input.starts_from ?? x.startsFrom } : x));
  holdToRules(tx, journey);
  journeys.save(journey);
}

/** Removes a journey test with the links it starts. Refused while anything else references it, such as a business outcome it measures. */
export function removeJourneyTest(tx: Transaction, input: RemoveJourneyTest): void {
  const journeys = new JourneyRepository(tx);
  const journey = journeys.loadHolding('journey_test', input.id) ?? tx.refuse('missing', `there is no journey test ${input.id}`);
  journey.tests = journey.tests.filter((x) => x.row.id !== input.id);
  journeys.save(journey);
}
