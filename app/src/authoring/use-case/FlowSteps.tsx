import { Fragment, useState } from 'react';
import type { FlowStep } from '../../../../lathe/src/authoring/use-case/model';
import { Button } from '../../components/Button';
import { Icon } from '../../components/icons';
import { kindLabel, type SpecIndex } from '../../specs/data';
import { ProblemBadge, RecordLink, Section } from '../../specs/parts';

// A flow's steps as a table, in order (the Use case page): the step, what happens, the command or query it invokes,
// the view it happens in, the UC requirements it fulfills and the integrations it exchanges with, read from the use
// case whole. A flow with several paths shows a table per path, main first, then the others by name, each in its own
// order. Each row shows one level: the step's title and the IDs it links to. What sits a level deeper (the titles and
// kinds of what it links to) is folded under the row's disclosure triangle, as in every other list.

/** The link columns after "What happens": each a link a step starts, as the use case holds it. */
const COLUMNS: readonly { heading: string; of: (step: FlowStep) => string[] }[] = [
  { heading: 'Invokes', of: (s) => (s.invokes ? [s.invokes] : []) },
  { heading: 'Happens in', of: (s) => (s.happensIn ? [s.happensIn] : []) },
  { heading: 'Fulfills', of: (s) => s.fulfills },
  { heading: 'Exchanges with', of: (s) => s.exchangesWith },
];

/** Steps by their position, a number, then by ID. */
const byPosition = (a: FlowStep, b: FlowStep) => a.row.position - b.row.position || a.row.id.localeCompare(b.row.id, 'en', { numeric: true });

/** A step's path, trimmed and in lower case: a step with no path is on the main path. */
const pathOf = (step: FlowStep) => step.row.path?.trim().toLowerCase() || 'main';

/** The steps path by path: the main path first, then the others by name, each in order. */
export function pathsOf(steps: readonly FlowStep[]): { path: string; steps: FlowStep[] }[] {
  const byPath = new Map<string, FlowStep[]>();
  for (const step of [...steps].sort(byPosition)) byPath.set(pathOf(step), [...(byPath.get(pathOf(step)) ?? []), step]);
  return [...byPath.entries()]
    .sort(([a], [b]) => (a === 'main' ? -1 : b === 'main' ? 1 : a.localeCompare(b)))
    .map(([path, onPath]) => ({ path, steps: onPath }));
}

/** A path's heading: "Main path", "Refused path". */
const pathLabel = (path: string) => `${path.charAt(0).toUpperCase()}${path.slice(1)} path`;

function IdLinks({ index, ids, label }: { index: SpecIndex; ids: string[]; label: string }) {
  if (ids.length === 0) return <span className="hint">None</span>;
  return (
    <ul className="step-ids" aria-label={label}>
      {ids.map((id) => (
        <li key={id} title={index.byId.get(id)?.title}><RecordLink index={index} id={id} showTitle={false} /></li>
      ))}
    </ul>
  );
}

function TitledLinks({ index, ids, heading }: { index: SpecIndex; ids: string[]; heading: string }) {
  if (ids.length === 0) return null;
  return (
    <div className="step-detail-links">
      <h4>{heading}</h4>
      <ul className="plain">
        {ids.map((id) => {
          const target = index.byId.get(id);
          return (
            <li key={id}>
              <RecordLink index={index} id={id} />
              {target && <small className="meta"> {kindLabel(index, target.kind)}</small>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The Steps section of a flow, from its steps as the use case holds them; nothing when it has none. */
export function FlowSteps({ index, flow, steps }: { index: SpecIndex; flow: string; steps: readonly FlowStep[] }) {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  if (steps.length === 0) return null;
  const allOpen = steps.every((s) => open.has(s.row.id));
  const toggle = (id: string) => setOpen((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const paths = pathsOf(steps);

  const table = (onPath: FlowStep[], caption: string) => (
    <div className="table-scroll">
      <table className="data-table flow-steps">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Step</th>
            <th scope="col">What happens</th>
            {COLUMNS.map((c) => <th key={c.heading} scope="col">{c.heading}</th>)}
          </tr>
        </thead>
        <tbody>
          {onPath.map((step) => {
            const { id } = step.row;
            const linked = COLUMNS.map((c) => ({ heading: c.heading, ids: c.of(step) }));
            const isOpen = open.has(id);
            return (
              <Fragment key={id}>
                <tr className="flow-step" data-step={id}>
                  <th scope="row">
                    <span className="step-head">
                      <button type="button" className="tree-toggle" aria-expanded={isOpen} aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${id}`} onClick={() => toggle(id)}>
                        <Icon name={isOpen ? 'chevron-down' : 'chevron-right'} size={14} />
                      </button>
                      <span className="step-order">{step.row.position}</span>
                      <RecordLink index={index} id={id} showTitle={false} />
                    </span>
                  </th>
                  <td>
                    {step.row.title} <ProblemBadge problems={index.problemsFor.get(id) ?? []} />
                  </td>
                  {linked.map((c) => <td key={c.heading}><IdLinks index={index} ids={c.ids} label={`${id} ${c.heading.toLowerCase()}`} /></td>)}
                </tr>
                {isOpen && (
                  <tr className="flow-step-detail">
                    <td colSpan={2 + linked.length}>
                      <div className="flow-step-more" role="region" aria-label={`Details of ${id}`}>
                        {linked.every((c) => c.ids.length === 0) && <p className="hint">The step links to nothing.</p>}
                        {linked.map((c) => <TitledLinks key={c.heading} index={index} ids={c.ids} heading={c.heading} />)}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <Section title="Steps" count={steps.length}>
      <div className="long-list-tools short">
        <Button onClick={() => setOpen(allOpen ? new Set() : new Set(steps.map((s) => s.row.id)))}>
          {allOpen ? 'Collapse all' : 'Expand all'}
        </Button>
      </div>
      {/* One path is one table; several are a table each, the main path first. */}
      {paths.length === 1 ? table(paths[0].steps, `Steps of ${flow}, in order`) : paths.map(({ path, steps: onPath }) => (
        <section key={path} className="flow-path" aria-label={pathLabel(path)}>
          <h3>{pathLabel(path)}<span className="section-count">{onPath.length}</span></h3>
          {table(onPath, `Steps of the ${path} path of ${flow}, in order`)}
        </section>
      ))}
    </Section>
  );
}
