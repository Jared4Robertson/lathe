import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { moveStep } from '../../../platform/data/step-order.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { JourneyStepRow } from '../../../platform/data/tables.ts';
import { JourneyRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { MOVE_JOURNEY_STEP_IDENTITY } from './identities.generated.ts';

/** The step, the path it goes to (its own when none is given) and the position it takes there. */
export type MoveJourneyStep = Pick<JourneyStepRow, 'id' | 'position'> & { path?: string };

export const MOVE_JOURNEY_STEP = {
  ...MOVE_JOURNEY_STEP_IDENTITY,
  input: {
    id: column('journey_step', 'id', 'required'),
    path: column('journey_step', 'path', 'optional'),
    position: column('journey_step', 'position', 'required'),
  },
  handler: moveJourneyStep,
} satisfies CommandDefinition<MoveJourneyStep>;

/** Puts the step at the position of the path, and renumbers the path it leaves and the path it joins so each stays 1, 2, 3. */
export function moveJourneyStep(tx: Transaction, input: MoveJourneyStep): void {
  const journeys = new JourneyRepository(tx);
  const journey = journeys.loadHolding('journey_step', input.id) ?? tx.refuse('missing', `there is no journey step ${input.id}`);
  const moved = new Map(moveStep(journey.steps.map((s) => s.row), input.id, input.path, input.position, (rule, message) => tx.refuse(rule, message)).map((row) => [row.id, row]));
  journey.steps = journey.steps.map((s) => ({ ...s, row: moved.get(s.row.id)! }));
  holdToRules(tx, journey);
  journeys.save(journey);
}
