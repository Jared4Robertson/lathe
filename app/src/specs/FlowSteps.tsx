import { Fragment, useState } from 'react';
import { Icon } from '../components/icons';
import { kindLabel, type SpecIndex, type SpecRecord } from './data';
import { RecordMarkdown } from './mentions';
import { ProblemBadge, RecordLink, Section } from './parts';
import { Button } from '../components/Button';

// A flow's steps as a table, in order (FORMAT.md section 14): the step, what happens, what it uses
// and what it carries out. A technical flow's steps (section 21) read the same way, with the
// component each step uses and what it satisfies, and their transaction, locks and statements
// folded under the row. A flow with several paths shows a table per path, main first, then the
// others by name, each in its own order. Each row shows one level: the step's title and the IDs it links to. What
// sits a level deeper (the step's body, and the titles and kinds of what it uses and fulfills) is
// folded under the row's disclosure triangle, as in every other list.

export const FLOW_STEP = 'flow_step';
export const DESIGN_STEP = 'design_step';

/** How a kind of flow shows its steps: the step kind, and the two link columns after "What happens". */
interface StepTableKind {
  step: string;
  columns: { relation: string; heading: string }[];
  /** Fields of a step shown in its folded details, when it has them. */
  details: string[];
}

const STEP_TABLES: Record<string, StepTableKind> = {
  flow: {
    step: FLOW_STEP,
    columns: [{ relation: 'uses', heading: 'Uses' }, { relation: 'fulfills', heading: 'Carries out' }],
    details: [],
  },
  design_flow: {
    step: DESIGN_STEP,
    columns: [{ relation: 'uses', heading: 'Component' }, { relation: 'satisfies', heading: 'Satisfies' }],
    details: ['transaction', 'locks', 'statements'],
  },
};

/** Whether a kind's page shows its children as a step table: a flow and a technical flow. */
export const hasSteps = (kind: string) => kind in STEP_TABLES;

/** A step's order as a number, or null when it is not a whole number. */
export function stepOrder(step: SpecRecord): number | null {
  const raw = step.fields.order?.trim() ?? '';
  return /^\d+$/.test(raw) ? Number(raw) : null;
}

/** A flow's (or a technical flow's) steps, by order (as numbers), then by ID; a step with no valid order goes last. */
export function stepsOf(index: SpecIndex, flowId: string): SpecRecord[] {
  const stepKind = STEP_TABLES[index.byId.get(flowId)?.kind ?? '']?.step ?? FLOW_STEP;
  const steps = (index.children.get(flowId) ?? []).filter((c) => c.kind === stepKind);
  return [...steps].sort((a, b) => {
    const oa = stepOrder(a);
    const ob = stepOrder(b);
    if (oa !== ob) return oa === null ? 1 : ob === null ? -1 : oa - ob;
    return a.id.localeCompare(b.id, 'en', { numeric: true });
  });
}

/** A step's path, trimmed and in lower case: a step with no path is on the main path. */
export const stepPath = (step: SpecRecord) => step.fields.path?.trim().toLowerCase() || 'main';

/** A flow's steps path by path: the main path first, then the others by name, each in order. */
export function pathsOf(index: SpecIndex, flowId: string): { path: string; steps: SpecRecord[] }[] {
  const byPath = new Map<string, SpecRecord[]>();
  for (const step of stepsOf(index, flowId)) byPath.set(stepPath(step), [...(byPath.get(stepPath(step)) ?? []), step]);
  return [...byPath.entries()]
    .sort(([a], [b]) => (a === 'main' ? -1 : b === 'main' ? 1 : a.localeCompare(b)))
    .map(([path, steps]) => ({ path, steps }));
}

/** A path's heading: "Main path", "Refused path". */
export const pathLabel = (path: string) => `${path.charAt(0).toUpperCase()}${path.slice(1)} path`;

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

/** The fields a step's details show, by name. */
function StepFields({ step, names }: { step: SpecRecord; names: string[] }) {
  const given = names.filter((name) => step.fields[name]?.trim());
  if (given.length === 0) return null;
  return (
    <dl className="fields step-fields">
      {given.map((name) => (
        <div key={name}><dt>{name.replaceAll('_', ' ')}</dt><dd>{step.fields[name]}</dd></div>
      ))}
    </dl>
  );
}

export function FlowSteps({ index, flow }: { index: SpecIndex; flow: SpecRecord }) {
  const shape = STEP_TABLES[flow.kind] ?? STEP_TABLES.flow;
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
              {shape.columns.map((c) => <th key={c.relation} scope="col">{c.heading}</th>)}
            </tr>
          </thead>
          <tbody>
            {pathSteps.map((step) => {
              const linked = shape.columns.map((c) => ({ ...c, ids: targetsOf(index, step.id, c.relation) }));
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
                        <span className="step-order">{order ?? step.fields.order ?? '?'}</span>
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
                          {step.body.trim() ? <RecordMarkdown index={index} record={step} /> : <p className="hint">The step says nothing more.</p>}
                          <StepFields step={step} names={shape.details} />
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
