import { Fragment, useState } from 'react';
import type { PathOnPage, StepOnPage } from '../../../../lathe/src/use-cases/use-case/read-model';
import { Button } from '../../components/Button';
import { Icon } from '../../components/icons';
import { kindLabel, type RecordIndex } from '../../exploring/record-summaries/record-index';
import { StepMoves } from '../../edit/StepMoves';
import { ProblemBadge, RecordLink, Section } from '../../specs/parts';
import { TableScroll } from '../../components/TableScroll';

// A flow's steps as a table, in order (the Use case page, the flow as written): the step, what happens (a variant
// marked with the one interface that does it), the command or query it invokes, the UC requirements it fulfills and
// the integrations it exchanges with, path by path as the use case's read model orders them. A flow with several paths shows a table per path, main first, then the others by
// name, each in its own order. Each row shows one level: the step's title and the IDs it links to. What sits a level deeper (the titles and
// kinds of what it links to) is folded under the row's disclosure triangle, as in every other list.

/** The link columns after "What happens": each a link a step starts, as the use case holds it. */
const COLUMNS: readonly { heading: string; of: (step: StepOnPage) => string[] }[] = [
  { heading: 'Invokes', of: (s) => (s.invokes ? [s.invokes] : []) },
  { heading: 'Fulfills', of: (s) => s.fulfills },
  { heading: 'Exchanges with', of: (s) => s.exchangesWith },
];

/** A path's heading: "Main path", "Refused path". */
export const pathLabel = (path: string) => `${path.charAt(0).toUpperCase()}${path.slice(1)} path`;

function IdLinks({ index, ids, label }: { index: RecordIndex; ids: string[]; label: string }) {
  if (ids.length === 0) return <span className="hint">None</span>;
  return (
    <ul className="step-ids" aria-label={label}>
      {ids.map((id) => (
        <li key={id} title={index.byId.get(id)?.title}><RecordLink index={index} id={id} showTitle={false} /></li>
      ))}
    </ul>
  );
}

/** A variant's mark: the one interface that does the step, by its title. */
export function VariantTag({ index, step }: { index: RecordIndex; step: StepOnPage }) {
  const only = step.step.interface_id;
  if (!only) return null;
  return <small className="meta step-variant" data-meta="variant">Only in {index.byId.get(only)?.title ?? only}</small>;
}

function TitledLinks({ index, ids, heading }: { index: RecordIndex; ids: string[]; heading: string }) {
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
export function FlowSteps({ index, flow, paths }: { index: RecordIndex; flow: string; paths: readonly PathOnPage[] }) {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const steps = paths.flatMap((p) => p.steps);
  if (steps.length === 0) return null;
  const allOpen = steps.every((s) => open.has(s.step.id));
  const toggle = (id: string) => setOpen((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const table = (onPath: readonly StepOnPage[], caption: string) => (
    <TableScroll stack>
      <table className="data-table flow-steps" role="table">
        <caption className="sr-only">{caption}</caption>
        <thead role="rowgroup">
          <tr role="row">
            <th scope="col" role="columnheader">Step</th>
            <th scope="col" role="columnheader" className="step-what">What happens</th>
            {COLUMNS.map((c) => <th key={c.heading} scope="col" role="columnheader">{c.heading}</th>)}
          </tr>
        </thead>
        <tbody role="rowgroup">
          {onPath.map((step, at) => {
            const { id } = step.step;
            const linked = COLUMNS.map((c) => ({ heading: c.heading, ids: c.of(step) }));
            const isOpen = open.has(id);
            return (
              <Fragment key={id}>
                <tr className="flow-step" data-step={id} role="row">
                  <th scope="row" role="rowheader">
                    <span className="step-head">
                      <button type="button" className="tree-toggle" aria-expanded={isOpen} aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${id}`} onClick={() => toggle(id)}>
                        <Icon name={isOpen ? 'chevron-down' : 'chevron-right'} size={14} />
                      </button>
                      <span className="step-order">{step.step.position}</span>
                      <RecordLink index={index} id={id} showTitle={false} />
                    </span>
                    <StepMoves route="/api/use-case/move-flow-step" id={id} up={onPath[at - 1]?.step.position ?? null} down={onPath[at + 1]?.step.position ?? null} />
                  </th>
                  <td className="step-what" role="cell">
                    {step.step.title} <VariantTag index={index} step={step} /> <ProblemBadge problems={index.problemsFor.get(id) ?? []} />
                  </td>
                  {linked.map((c) => <td key={c.heading} role="cell" data-label={c.heading}><IdLinks index={index} ids={c.ids} label={`${id} ${c.heading.toLowerCase()}`} /></td>)}
                </tr>
                {isOpen && (
                  <tr className="flow-step-detail" role="row">
                    <td colSpan={2 + linked.length} role="cell">
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
    </TableScroll>
  );

  return (
    <Section title="Steps" count={steps.length}>
      <div className="long-list-tools short">
        <Button onClick={() => setOpen(allOpen ? new Set() : new Set(steps.map((s) => s.step.id)))}>
          {allOpen ? 'Collapse all' : 'Expand all'}
        </Button>
      </div>
      {/* One path is one table; several are a table each, the main path first. */}
      {paths.length === 1 ? table(paths[0].steps, `Steps of ${flow}, in order`) : paths.map(({ name, steps: onPath }) => (
        <section key={name} className="flow-path" aria-label={pathLabel(name)}>
          <h3>{pathLabel(name)}<span className="section-count">{onPath.length}</span></h3>
          {table(onPath, `Steps of the ${name} path of ${flow}, in order`)}
        </section>
      ))}
    </Section>
  );
}
