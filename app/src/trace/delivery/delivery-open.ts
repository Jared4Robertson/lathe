import { useCallback, useState } from 'react';
import { keepCamera } from '../../exploring/tab-set/commands/keep-camera';
import { keptCamera } from '../../exploring/tab-set/reads';
import { runTabSetCommand } from '../../exploring/tab-set/run';

// What the Delivery view opens, per place (LA-V98): each tab keeps its own, as it keeps its camera (the Tab set's
// cameras, exploring/tab-set, LA-EXP-CMD28), under the view's own stage name; a place with no key keeps it while the
// view is shown.

const OPEN_STAGE = 'trace-delivery-open';
const FRAMED = 'open';

/** The place's open boxes, and their setter, which keeps them for the place. */
export function useOpenness(place: string | undefined): [ReadonlySet<string>, (next: ReadonlySet<string>) => void] {
  const load = (p: string | undefined): ReadonlySet<string> => new Set(p ? keptCamera<string[]>(p, OPEN_STAGE, FRAMED) ?? [] : []);
  const [state, setState] = useState(() => ({ place, open: load(place) }));
  const current = state.place === place ? state : { place, open: load(place) };
  if (current !== state) setState(current);
  const set = useCallback((next: ReadonlySet<string>) => {
    setState({ place, open: next });
    if (place) runTabSetCommand(keepCamera, { place, stage: OPEN_STAGE, camera: { framed: FRAMED, view: [...next] } });
  }, [place]);
  return [current.open, set];
}
