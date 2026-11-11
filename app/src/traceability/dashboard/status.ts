import { figureText, lowerLabel } from '../../plural';
import { METRICS, type MetricFigure, type MetricKey } from '../../specs/metrics';

// A product's Status (LA-TRC-UC26-R01): the ladder over the Dashboard's six tiles, read left to right: Status is the first
// tile that is not complete, and that tile wears the heavier border. There is no score and no weighting, so anyone can
// check it against the row beneath it. Warnings do not move it; they are suggestions, shown on the Errors tile.

/** The tiles the ladder reads, left to right. */
export const LADDER: readonly { key: MetricKey; status: string; complete: (f: MetricFigure) => boolean }[] = [
  { key: 'errors', status: 'Failing its own checks', complete: (f) => f.value === 0 },
  { key: 'designed', status: 'Not fully designed', complete: (f) => f.value === f.total },
  { key: 'built', status: 'Designed, not fully built', complete: (f) => f.value === f.total },
  { key: 'proved', status: 'Built, not fully proved', complete: (f) => f.value === f.total },
  { key: 'journeysProved', status: 'Proved piece by piece, not yet end to end', complete: (f) => f.total! > 0 && f.value === f.total },
  { key: 'gaps', status: 'Proved end to end, with gaps between spec and code', complete: (f) => f.value === 0 },
];

export const COMPLETE = 'Complete against its spec';
export const NOTHING_TO_JUDGE = 'Nothing to judge yet';

/** A shortfall the line under Status names, leading where its tile does. */
export interface Clause { text: string; to?: string }

export interface Status {
  /** The sentence. */
  text: string;
  /** The tile the sentence names: the first not complete, or null with none. */
  rung: MetricKey | null;
  /** What is still short, each leading to its tile's destination. */
  short: Clause[];
  /** The closing words after them. */
  closing: string;
}

const many = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

function clauseOf(f: MetricFigure): Clause {
  const words = lowerLabel(METRICS[f.key].label);
  switch (f.key) {
    case 'errors': return { text: many(f.value!, 'error'), to: f.to };
    case 'gaps': return { text: many(f.value!, 'gap'), to: f.to };
    case 'journeysProved': return { text: f.total ? `${f.value} of ${many(f.total, 'journey')} proved` : 'no journeys yet', to: f.to };
    default: return { text: `${figureText(f.value!)} of ${figureText(f.total!)} obligations ${words}`, to: f.to };
  }
}

const figure = (tiles: readonly MetricFigure[], key: MetricKey) => tiles.find((t) => t.key === key)!;

/**
 * The Status of a product from its six tiles, or null while any is being read: never judged from a figure not read.
 * With no obligations at all there is nothing to judge, unless its own checks fail, which is true of any product.
 */
export function statusOf(tiles: readonly MetricFigure[]): Status | null {
  if (LADDER.some(({ key }) => figure(tiles, key).value === undefined)) return null;
  const proved = figure(tiles, 'proved');
  const short = LADDER.filter((r) => !r.complete(figure(tiles, r.key)));
  const noObligations = (proved.total ?? 0) === 0;
  if (noObligations && !short.some((r) => r.key === 'errors')) return { text: NOTHING_TO_JUDGE, rung: null, short: [], closing: 'It has no obligations to design, build or prove yet.' };
  const clauses = short.map((r) => clauseOf(figure(tiles, r.key)));
  const onItsOwn = !noObligations && !short.some((r) => r.key === 'designed' || r.key === 'built' || r.key === 'proved');
  return {
    text: short.length ? short[0].status : COMPLETE,
    rung: short[0]?.key ?? null,
    short: clauses,
    closing: !short.length ? 'Every obligation is designed, built and proved, every journey is proved and there are no gaps.'
      : onItsOwn ? 'Every obligation is designed, built and proved on its own.' : '',
  };
}
