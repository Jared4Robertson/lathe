import { Fragment, useState } from 'react';
import { Icon } from '../components/icons';
import { textOf, kindLabel, type SpecIndex, type SpecRecord } from './data';
import { Prose } from './mentions';
import { ProblemBadge, RecordLink, Section } from './parts';
import { Button } from '../components/Button';

// A flow's steps as a table, in order (lathe/REFERENCE.md): the step, what happens, the command or
// query it invokes, the view it happens in, the UC requirements it fulfills and the integrations it
// exchanges with. A flow with several paths shows a table per path, main first, then the others by
// name, each in its own order. Each row shows one level: the step's title and the IDs it links to.
// What sits a level deeper (the step's description, and the titles and kinds of what it links to) is
// folded under the row's disclosure triangle, as in every other list.

/** The link columns after "What happens", each a relation a step starts. */
const COLUMNS: readonly { relation: string; heading: string }[] = [
  { relation: 'invokes', heading: 'Invokes' },
  { relation: 'happens_in', heading: 'Happens in' },
  { relation: 'fulfills', heading: 'Fulfills' },
  { relation: 'exchanges_with', heading: 'Exchanges with' },
];

/** A step's order as a number, or null when it is not a whole number. */
function stepOrder(step: SpecRecord): number | null {
  const raw = textOf(step.row, 'position')?.trim() ?? '';
  return /^\d+$/.test(raw) ? Number(raw) : null;
}

/** A flow's steps, by order (as numbers), then by ID; a step with no valid order goes last. */
function stepsOf(index: SpecIndex, flowId: string): SpecRecord[] {
  const steps = (index.children.get(flowId) ?? []).filter((c) => c.kind === 'flow_step');
  return [...steps].sort((a, b) => {
    const oa = stepOrder(a);
    const ob = stepOrder(b);
    if (oa !== ob) return oa === null ? 1 : ob === null ? -1 : oa - ob;
    return a.id.localeCompare(b.id, 'en', { numeric: true });
  });
}

/** A step's path, trimmed and in lower case: a step with no path is on the main path. */
const stepPath = (step: SpecRecord) => textOf(step.row, 'path')?.trim().toLowerCase() || 'main';

/** A flow's steps path by path: the main path first, then the others by name, each in order. */
function pathsOf(index: SpecIndex, flowId: string): { path: string; steps: SpecRecord[] }[] {
  const byPath = new Map<string, SpecRecord[]>();
  for (const step of stepsOf(index, flowId)) byPath.set(stepPath(step), [...(byPath.get(stepPath(step)) ?? []), step]);
  return [...byPath.entries()]
    .sort(([a], [b]) => (a === 'main' ? -1 : b === 'main' ? 1 : a.localeCompare(b)))
    .map(([path, steps]) => ({ path, steps }));
}

/** A path's heading: "Main path", "Refused path". */
const pathLabel = (path: string) => `${path.charAt(0).toUpperCase()}${path.slice(1)} path`;

const targetsOf = (index: SpecIndex, id: string, relation: string) =>
  (index.outgoing.get(id) ?? []).filter((l) => l.relation === relation).map((l) => l.target);

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

export function FlowSteps({ index, flow }: { index: SpecIndex; flow: SpecRecord }) {
  const steps = stepsOf(index, flow.id);
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  if (steps.length === 0) return null;
  const allOpen = steps.every((s) => open.has(s.id));
  const toggle = (id: string) => setOpen((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const paths = pathsOf(index, flow.id);

  const table = (pathSteps: SpecRecord[], caption: string) => (
      <div className="table-scroll">
        <table className="data-table flow-steps">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              <th scope="col">Step</th>
              <th scope="col">What happens</th>
              {COLUMNS.map((c) => <th key={c.relation} scope="col">{c.heading}</th>)}
            </tr>
          </thead>
          <tbody>
            {pathSteps.map((step) => {
              const linked = COLUMNS.map((c) => ({ ...c, ids: targetsOf(index, step.id, c.relation) }));
              const isOpen = open.has(step.id);
              const order = stepOrder(step);
              return (
                <Fragment key={step.id}>
                  <tr className="flow-step" data-step={step.id}>
                    <th scope="row">
                      <span className="step-head">
                        <button
                          type="button"
                          className="tree-toggle"
                          aria-expanded={isOpen}
                          aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${step.id}`}
                          onClick={() => toggle(step.id)}
                        >
                          <Icon name={isOpen ? 'chevron-down' : 'chevron-right'} size={14} />
                        </button>
                        <span className="step-order">{order ?? textOf(step.row, 'position') ?? '?'}</span>
                        <RecordLink index={index} id={step.id} showTitle={false} />
                      </span>
                    </th>
                    <td>
                      {step.title} <ProblemBadge problems={index.problemsFor.get(step.id) ?? []} />
                    </td>
                    {linked.map((c) => (
                      <td key={c.relation}><IdLinks index={index} ids={c.ids} label={`${step.id} ${c.heading.toLowerCase()}`} /></td>
                    ))}
                  </tr>
                  {isOpen && (
                    <tr className="flow-step-detail">
                      <td colSpan={2 + linked.length}>
                        <div className="flow-step-more" role="region" aria-label={`Details of ${step.id}`}>
                          {textOf(step.row, 'description').trim() ? <Prose index={index} source={textOf(step.row, 'description')} self={step.id} /> : <p className="hint">The step says nothing more.</p>}
                          {linked.map((c) => <TitledLinks key={c.relation} index={index} ids={c.ids} heading={c.heading} />)}
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
        <Button onClick={() => setOpen(allOpen ? new Set() : new Set(steps.map((s) => s.id)))}>
          {allOpen ? 'Collapse all' : 'Expand all'}
        </Button>
      </div>
      {/* One path is one table; several are a table each, the main path first. */}
      {paths.length === 1 ? table(paths[0].steps, `Steps of ${flow.id}, in order`) : paths.map(({ path, steps: pathSteps }) => (
        <section key={path} className="flow-path" aria-label={pathLabel(path)}>
          <h3>{pathLabel(path)}<span className="section-count">{pathSteps.length}</span></h3>
          {table(pathSteps, `Steps of the ${path} path of ${flow.id}, in order`)}
        </section>
      ))}
    </Section>
  );
}
