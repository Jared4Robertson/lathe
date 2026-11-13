// The Journey read model (LA-PRD-RM44), shaped for its readers: the Journey page reads a journey as a tree (its trigger
// and result, the outcomes it serves, its steps path by path in order with what each carries out, and its journey
// test), a product's list reads each journey's ID and title, and the editor's next ID reads the IDs in use. The
// projection (journeyTableFrom) is the only code that reads the source rows and the only code that writes the read
// model's table; the query handlers read that table only through the reader (reader.ts). Nothing here is the
// aggregate's own instance type.
import { byRecordId } from '../../platform/data/ids.ts';
import type { ReadView } from '../../platform/data/rules.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { JourneyRow, JourneyStepRow, JourneyTestRow } from '../../platform/data/tables.ts';
import { inPathOrder, pathOf } from './appearances.ts';
import { placementOf, useCaseGroupOf, type UseCaseGroup } from '../../exploring/placement.ts';
import type { JourneyKind } from './model.ts';

/** A record named by its ID and title. */
export interface Named {
  id: string;
  title: string;
}

/** What a step carries out: a use case with its actors, group (its result's aggregate or read model) and domain, or a policy (a handoff) with the event it hears, the command it sends and its domain. */
export type CarriedOut =
  | { kind: 'use_case'; id: string; title: string; actors: string[]; group: UseCaseGroup | null; domain: Named }
  | { kind: 'policy'; id: string; title: string; hears: Named | null; sends: Named; domain: Named };

/** A step as the page shows it: its row and what it carries out, or none yet. */
export interface StepOnPage {
  step: JourneyStepRow;
  carriesOut: CarriedOut | null;
}

/** One path of a journey: its name in lower case (main for a step with none), and its steps in order. */
export interface PathOnPage {
  name: string;
  steps: StepOnPage[];
}

/** A journey test as the page shows it: its row and the test data sets it starts from. */
export interface TestOnPage {
  test: JourneyTestRow;
  startsFrom: string[];
}

/** A journey whole, as its page shows it. */
export interface JourneyTree {
  journey: JourneyRow;
  /** The business outcomes it serves, sorted. */
  serves: string[];
  /** Its paths: main first, then the others by name. */
  paths: PathOnPage[];
  test: TestOnPage | null;
}

/** A journey as its page reads it, with the record of it the page is about. */
export interface JourneyPage extends JourneyTree {
  /** The record the page is about, and its kind in the journey. */
  record: { id: string; kind: JourneyKind };
}

/** A journey as a product's list reads it. */
export interface JourneySummary {
  id: string;
  title: string;
}

/** The read model's table, kept in memory: what the reader reads, and all it reads. */
export interface JourneyTable {
  /** Each journey whole, by its ID. */
  journeys: Map<string, JourneyTree>;
  /** Each record inside a journey: the journey that holds it and its kind there. */
  holding: Map<string, { root: string; kind: JourneyKind }>;
  /** Each product's journeys, by ID. */
  lists: Map<string, JourneySummary[]>;
  /** Every record ID in use, with its kind: what a next ID is one past, and what a refusal names. */
  kinds: Map<string, string>;
}

function grouped<T>(rows: Row[], column: string): Map<string, T[]> {
  const found = new Map<string, T[]>();
  for (const r of rows) found.set(String(r[column]), [...(found.get(String(r[column])) ?? []), r as unknown as T]);
  return found;
}

/** A link table's targets by source, each list sorted. */
function targets(view: ReadView, table: string): (source: string) => string[] {
  const bySource = grouped<{ target_id: string }>(view.rows(table), 'source_id');
  return (source) => (bySource.get(source) ?? []).map((l) => l.target_id).sort();
}

/** The steps path by path: the main path first, then the others by name, each in position order. */
function pathsOf(steps: StepOnPage[]): PathOnPage[] {
  const byPath = new Map<string, StepOnPage[]>();
  for (const s of inPathOrder(steps.map((x) => ({ ...x, id: x.step.id, position: x.step.position })))) byPath.set(pathOf(s.step), [...(byPath.get(pathOf(s.step)) ?? []), { step: s.step, carriesOut: s.carriesOut }]);
  return [...byPath.entries()]
    .sort(([a], [b]) => (a === 'main' ? -1 : b === 'main' ? 1 : a.localeCompare(b)))
    .map(([name, onPath]) => ({ name, steps: onPath }));
}

/** The projection: the read model's table, built from the rows on each read (in memory; nothing keeps it). */
export function journeyTableFrom(view: ReadView): JourneyTable {
  const [serves, carriesOut, startsFrom, hears] = ['serves', 'carries_out', 'starts_from', 'hears'].map((t) => targets(view, t));
  const actors = grouped<{ position: number; role_name: string }>(view.rows('use_case_actor'), 'use_case_id');
  const steps = grouped<JourneyStepRow>(view.rows('journey_step'), 'journey_id');
  const tests = grouped<JourneyTestRow>(view.rows('journey_test'), 'journey_id');
  const named = (id: unknown): Named => {
    const found = view.record(String(id));
    return { id: String(id), title: String(found?.row.title ?? id) };
  };
  const domainOfAggregate = (aggregateId: unknown): Named => named(view.record(String(aggregateId))?.row.domain_id);
  const placed = placementOf(view);
  const carried = (id: string): CarriedOut | null => {
    const target = view.record(id);
    if (target?.kind === 'use_case') {
      return {
        kind: 'use_case',
        id,
        title: String(target.row.title),
        actors: [...(actors.get(id) ?? [])].sort((a, b) => Number(a.position) - Number(b.position)).map((a) => String(a.role_name)),
        group: useCaseGroupOf(placed, id),
        domain: named(target.row.domain_id),
      };
    }
    if (target?.kind === 'policy') {
      const command = view.record(String(target.row.command_id));
      const entity = view.record(String(command?.row.entity_id));
      const event = hears(id)[0];
      return { kind: 'policy', id, title: String(target.row.title), hears: event ? named(event) : null, sends: named(target.row.command_id), domain: domainOfAggregate(entity?.row.aggregate_id) };
    }
    return null;
  };

  const journeys = new Map<string, JourneyTree>();
  const holding = new Map<string, { root: string; kind: JourneyKind }>();
  const lists = new Map<string, JourneySummary[]>();
  for (const journey of view.rows('journey') as unknown as JourneyRow[]) {
    const root = journey.id;
    const own = (steps.get(root) ?? []).map((step) => ({ step, carriesOut: (carriesOut(step.id)[0] && carried(carriesOut(step.id)[0])) || null }));
    const test = (tests.get(root) ?? [])[0];
    const tree: JourneyTree = { journey, serves: serves(root), paths: pathsOf(own), test: test ? { test, startsFrom: startsFrom(test.id) } : null };
    holding.set(root, { root, kind: 'journey' });
    for (const s of own) holding.set(s.step.id, { root, kind: 'journey_step' });
    if (test) holding.set(test.id, { root, kind: 'journey_test' });
    journeys.set(root, tree);
    lists.set(journey.product_id, [...(lists.get(journey.product_id) ?? []), { id: root, title: journey.title }]);
  }
  for (const list of lists.values()) list.sort(byRecordId);
  const kinds = new Map<string, string>();
  for (const kind of Object.keys(view.schema.kinds)) for (const row of view.rows(kind)) kinds.set(String(row.id), kind);
  return { journeys, holding, lists, kinds };
}
