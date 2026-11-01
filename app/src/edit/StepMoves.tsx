import { Button } from '../components/Button';
import { useAnnounce } from '../shell/commands';
import { useWriter, type CommandInputs } from './write';

// Move up and Move down on a step of a flow or a journey, the one way to put a step in another place (LA-PAT-FIELD-INPUTS):
// each sends the aggregate's own Move for the step, with the position of its neighbor on its path, and the aggregate
// renumbers the path so it stays 1, 2, 3. Nothing is offered where the records are only read, and the first step of a
// path has no Move up, the last no Move down. A step goes to the position of its neighbor, so a path numbered with gaps still moves one place.

/** The Move commands: a flow step's and a journey step's. */
type MoveRoute = '/api/use-case/move-flow-step' | '/api/journey/move-journey-step';

/** `up` and `down` are the positions of the steps before and after it on its path, where it goes to; none for the first and last. */
export function StepMoves({ route, id, up, down }: { route: MoveRoute; id: string; up: number | null; down: number | null }) {
  const writer = useWriter();
  const announce = useAnnounce();
  if (!writer) return null;
  const move = async (to: number) => {
    const answer = await writer.command(route, { id, position: to } as CommandInputs[typeof route]);
    announce(answer.ok ? `Moved ${id} to position ${to}` : `Moving ${id} was refused: ${answer.problems[0]?.message ?? answer.error}`);
  };
  return (
    <span className="step-moves" role="group" aria-label={`Move ${id}`}>
      {up !== null && <Button onClick={() => move(up)} aria-label={`Move up ${id}`}>Move up</Button>}
      {down !== null && <Button onClick={() => move(down)} aria-label={`Move down ${id}`}>Move down</Button>}
    </span>
  );
}
