import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { FlowOnPage, StepOnPage } from '../../../../lathe/src/authoring/use-case/read-model';
import type { FlowThrough } from '../../../../lathe/src/authoring/use-case/through';
import { Button } from '../../components/Button';
import { type RecordIndex } from '../../exploring/record-summaries/record-index';
import { saysKind } from '../../specs/InterfaceParts';
import { ProblemBadge, RecordLink, Section } from '../../specs/parts';
import { FlowSteps, pathLabel } from './FlowSteps';

// A flow's page (LA-V101): a tab per interface that offers its use case. The first tab, All interfaces, is the flow as
// written (FlowSteps), the only place it is edited; each other tab, one per offering interface by ID, is that
// interface's version of it, derived by the use case's read model (through.ts) and never stored: the role who carries
// it out there, the patterns it follows, and its steps (the other interfaces' variants left out), each with where it is
// carried out (the views that present what it invokes, the endpoints that expose it or the product's own records), a
// step the interface cannot reach shown as a gap, and the rules of its patterns, which say how it reaches a step and
// shows a refusal. The tabs are a tablist: the arrow keys, Home and End move between them.

/** An interface's tab label: its title, from the space's index. */
const titleOf = (index: RecordIndex, id: string) => index.byId.get(id)?.title ?? id;

/** Record links in a row, or a hint. */
function Links({ index, ids, label, none }: { index: RecordIndex; ids: readonly string[]; label: string; none: ReactNode }) {
  if (ids.length === 0) return <span className="hint">{none}</span>;
  return <ul className="step-ids" aria-label={label}>{ids.map((id) => <li key={id} title={index.byId.get(id)?.title}><RecordLink index={index} id={id} showTitle={false} /></li>)}</ul>;
}

/** One interface's version of the flow: its actor, patterns and steps path by path, with where each is carried out. */
function Version({ index, flow, through }: { index: RecordIndex; flow: FlowOnPage; through: FlowThrough }) {
  const face = titleOf(index, through.interface);
  const written = new Map<string, StepOnPage>(flow.paths.flatMap((p) => p.steps).map((s) => [s.step.id, s]));
  const steps = through.paths.reduce((n, p) => n + p.steps.length, 0);
  return (
    <>
      <dl className="fields use-case-facts">
        <div><dt>Interface</dt><dd><RecordLink index={index} id={through.interface} />{saysKind({ title: face, kind: through.kind }) ? null : <> <small className="meta">{through.kind}</small></>}</dd></div>
        <div><dt>Actor</dt><dd>{through.actor ?? <span className="hint">None named</span>}</dd></div>
        {through.patterns.length > 0 && <div><dt>Follows</dt><dd><Links index={index} ids={through.patterns} label={`Patterns ${through.interface} follows`} none="" /></dd></div>}
        <div><dt>Carried out as</dt><dd>{through.rules.length === 0 ? <span className="hint">No pattern {face} follows says how it reaches a step or shows a refusal.</span> : <Links index={index} ids={through.rules} label={`Rules of the patterns ${through.interface} follows`} none="" />}</dd></div>
      </dl>
      <Section title="Steps" count={steps}>
        {steps === 0 && <p className="hint">No step of the flow is carried out through {face}.</p>}
        {through.paths.map((path) => (
          <section key={path.name} className="flow-path" aria-label={`${pathLabel(path.name)} through ${face}`}>
            <h3>{pathLabel(path.name)}<span className="section-count">{path.steps.length}</span></h3>
            <div className="table-scroll table-stack">
              <table className="data-table flow-steps" role="table">
                <caption className="sr-only">Steps of the {path.name} path of {flow.flow.id} through {face}, in order</caption>
                <thead role="rowgroup">
                  <tr role="row">
                    <th scope="col" role="columnheader">Step</th>
                    <th scope="col" role="columnheader" className="step-what">What happens</th>
                    <th scope="col" role="columnheader">Invokes</th>
                    <th scope="col" role="columnheader">Carried out in</th>
                  </tr>
                </thead>
                <tbody role="rowgroup">
                  {path.steps.map((s) => {
                    const step = written.get(s.id);
                    return (
                      <tr key={s.id} className={s.unreached ? 'flow-step is-gap' : 'flow-step'} data-step={s.id} role="row">
                        <th scope="row" role="rowheader">
                          <span className="step-head"><span className="step-order">{step?.step.position}</span><RecordLink index={index} id={s.id} showTitle={false} /></span>
                        </th>
                        <td className="step-what" role="cell">{step?.step.title ?? s.id} <ProblemBadge problems={index.problemsFor.get(s.id) ?? []} /></td>
                        <td role="cell" data-label="Invokes"><Links index={index} ids={step?.invokes ? [step.invokes] : []} label={`${s.id} invokes`} none="None" /></td>
                        <td role="cell" data-label="Carried out in">
                          {s.unreached
                            ? <span className="step-gap">Gap · {face} cannot reach {step?.invokes}</span>
                            : <Links index={index} ids={s.reach} label={`${s.id} is carried out in`} none="Nothing to reach" />}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </Section>
    </>
  );
}

/** The flow's tabs: All interfaces (the flow as written, where it is edited), then one per offering interface by ID. */
export function FlowInterfaces({ index, flow }: { index: RecordIndex; flow: FlowOnPage }) {
  const [at, setAt] = useState(0);
  const base = useId();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const labels = ['All interfaces', ...flow.through.map((t) => titleOf(index, t.interface))];
  const selected = Math.min(at, labels.length - 1);
  const pick = (i: number) => { setAt(i); tabs.current[i]?.focus(); };
  const onKey = (e: KeyboardEvent) => {
    const last = labels.length - 1;
    const to = { ArrowRight: selected === last ? 0 : selected + 1, ArrowLeft: selected === 0 ? last : selected - 1, Home: 0, End: last }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    pick(to);
  };
  return (
    <div>
      <div className="flow-tabs" role="tablist" aria-label={`Interfaces of ${flow.flow.id}`} onKeyDown={onKey}>
        {labels.map((label, i) => (
          <Button key={i} ref={(el: HTMLButtonElement | null) => { tabs.current[i] = el; }} role="tab" id={`${base}-tab-${i}`} aria-controls={`${base}-panel-${i}`}
            aria-selected={i === selected} tabIndex={i === selected ? 0 : -1} className="flow-tab" onClick={() => setAt(i)}
            data-interface={i === 0 ? undefined : flow.through[i - 1].interface}>
            {label}
          </Button>
        ))}
      </div>
      <div className="flow-tab-panel" role="tabpanel" id={`${base}-panel-${selected}`} aria-labelledby={`${base}-tab-${selected}`} tabIndex={0}>
        {selected === 0 ? (
          <>
            {flow.through.length === 0 && <p className="hint">No interface offers its use case yet.</p>}
            <FlowSteps index={index} flow={flow.flow.id} paths={flow.paths} />
          </>
        ) : (
          <Version index={index} flow={flow} through={flow.through[selected - 1]} />
        )}
      </div>
    </div>
  );
}
