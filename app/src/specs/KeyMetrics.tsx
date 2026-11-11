import { Link } from '../router';
import { METRICS, type MetricFigure } from './metrics';
import { Section } from './parts';

// Key metrics (LA-PAT-APP-UX-R25): the one row of figures a page leads with, under its lead text and before its
// sections. Each tile is its label, its number and its total with the unit ("3 of 7 obligations"), its meaning as a
// tooltip, and a line of detail when it has one; a tile that leads somewhere links its number there, with a touch-sized
// target. The labels, units and meanings are metrics.ts's, so every page says them the same way.

function Tile({ figure }: { figure: MetricFigure }) {
  const { label, unit, meaning } = METRICS[figure.key];
  const read = figure.value !== undefined;
  const value = read ? figure.value!.toLocaleString('en-US') : '…';
  const of = read && figure.total !== undefined ? ` of ${figure.total.toLocaleString('en-US')}${unit ? ` ${unit}` : ''}` : '';
  const spoken = read ? `${label}: ${value}${of}` : `${label}: reading`;
  const detail = figure.detail && read ? <>{' '}<small className="metric-detail">{figure.detail}</small></> : null;
  const number = <><span className="metric-value">{value}</span>{of && <span className="metric-of">{of}</span>}</>;
  return (
    <div className={`metric${figure.tone ? ` is-${figure.tone}` : ''}${figure.rung ? ' is-rung' : ''}`} data-metric={figure.key} title={meaning}>
      <dt>{label}</dt>
      <dd>
        {figure.to && read ? <Link to={figure.to} className="metric-link" aria-label={figure.detail ? `${spoken}, ${figure.detail}` : spoken}>{number}{detail}</Link> : <span className="metric-figure">{number}{detail}</span>}
      </dd>
    </div>
  );
}

/** The row of tiles itself, in the order given: a page's Key metrics section, or the Dashboard's row (LA-PAT-APP-UX-R25). */
export function MetricTiles({ figures }: { figures: readonly MetricFigure[] }) {
  return <dl className="metrics" aria-label="Key metrics">{figures.map((f) => <Tile key={f.key} figure={f} />)}</dl>;
}

/** The page's key metrics, in the order given. */
export function KeyMetrics({ figures }: { figures: readonly MetricFigure[] }) {
  return (
    <Section title="Key metrics" className="key-metrics">
      <MetricTiles figures={figures} />
    </Section>
  );
}
