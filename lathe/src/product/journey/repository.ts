// Generated from data/ by `npm run generate`. Do not edit.
// JourneyRepository (LA-PRD-REPO25): Loads a journey whole (its row, its steps with the carries_out link each starts,
// its journey test with its starts_from links, and the serves links it starts) and saves exactly the rows that changed,
// in its own tables only; removing a journey removes its steps and test, never what they carry out, and a removal is
// refused, naming the referrers, while anything else references them.
import { AggregateRepository as Repository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { JOURNEY_TABLES, journeyRows, journeysFrom, type Journey, type JourneyKind } from './model.ts';

export class JourneyRepository extends Repository<Journey> {
  constructor(tx: Transaction) {
    super(tx, 'JourneyRepository', JOURNEY_TABLES);
  }

  protected read(rootId: string): Journey | undefined {
    return journeysFrom((table) => this.files.rows(table), rootId)[0];
  }

  protected rowsOf(journey: Journey): InstanceRows {
    return journeyRows(journey);
  }

  /** Loads the journey that holds the record of the kind with this ID, found up its parents; undefined when there is none. */
  loadHolding(kind: JourneyKind, id: string): Journey | undefined {
    const root = this.rootOf(kind, id);
    const journey = root === undefined ? undefined : this.load(root);
    return journey && holds(journey, kind, id) ? journey : undefined;
  }

  // The root's ID, up the parents of the record of the kind with this ID; undefined when one of them is missing.
  private rootOf(kind: JourneyKind, id: string): string | undefined {
    const row = this.files.find(kind, { id });
    if (!row) return undefined;
    switch (kind) {
      case 'journey': return id;
      case 'journey_step': return this.rootOf('journey', String(row.journey_id));
      case 'journey_test': return this.rootOf('journey', String(row.journey_id));
    }
  }
}

/** Whether the journey holds the record of the kind with this ID. */
function holds(journey: Journey, kind: JourneyKind, id: string): boolean {
  switch (kind) {
    case 'journey': return journey.root === id;
    case 'journey_step': return journey.steps.some((x) => x.row.id === id);
    case 'journey_test': return journey.tests.some((x) => x.row.id === id);
  }
}
