import type { ReactNode } from 'react';
import type { UseCaseKind } from '../../../../lathe/src/use-cases/use-case/model';
import type { UseCasePage as UseCaseRead } from '../../../../lathe/src/use-cases/use-case/read-model';
import { Refusal, problemText } from '../../edit/fields';
import { LongList } from '../../components/LongList';
import { TreeList } from '../../components/TreeList';
import type { AggregatePageProps } from '../../record/pages';
import { Markdown } from '../../specs/Markdown';
import { Prose } from '../../specs/mentions';
import { RecordLink, RecordRowBody, Section, nestedCount, recordText } from '../../specs/parts';
import { RecordFrame } from '../../specs/RecordContent';
import { saysKind } from '../../specs/InterfaceParts';
import { groupRecords } from '../../specs/groups';
import { type RecordIndex, type RecordSummary } from '../../exploring/record-summaries/record-index';
import { InJourneys } from '../../product/journey/InJourneys';
import { FlowInterfaces } from './FlowInterfaces';
import { UseCaseEditor } from './UseCaseEditor';
import { stepsOf, useUseCase } from './reads';
import { useInterfaces } from '../../product/product/reads';

// The Use case page (LA-UCS-A11's page): any record of a use case, at its address (/<id>), drawn from the use case read whole
// (GET /api/use-case/get-use-case) and changed only through its own commands (UseCaseEditor). A use case shows its
// goal, actors and notes, its flow and the interfaces that offer it, and its UC requirements with their tests; a UC
// requirement its statement, its tests and the steps that fulfill it; a flow a tab per offering interface (the flow as
// written, then each interface's derived version, FlowInterfaces); a step what it links to and the interface it is a
// variant of; a test its scenario and what it starts from. What every record's page holds
// around that (traceability, problems, facts and links) is the Record page's (RecordFrame); the titles of the records
// it names come from the workspace's index while the other aggregates are read whole.

/** Records of the index, by ID, in the order given; an ID no record has is left out. */
const recordsOf = (index: RecordIndex, ids: readonly string[]) => ids.flatMap((id) => index.byId.get(id) ?? []);

/** Rows that each lead to one record: its row in the shell's look (link, fields, test state, gaps, problems). */
function Rows({ index, ids, label }: { index: RecordIndex; ids: readonly string[]; label: string }) {
  return (
    <LongList label={label} className="record-list" items={recordsOf(index, ids)} itemKey={(r) => r.id} searchText={recordText}
      render={(r) => <RecordRowBody index={index} record={r} />} />
  );
}

/** The use case's UC requirements under their groups, each with its tests folded under it. */
function Requirements({ index, useCase }: { index: RecordIndex; useCase: UseCaseRead }) {
  if (useCase.requirements.length === 0) return null;
  const testsOf = (requirement: RecordSummary) => recordsOf(index, (useCase.requirements.find((r) => r.requirement.id === requirement.id)?.tests ?? []).map((t) => t.test.id));
  const groups = groupRecords(recordsOf(index, useCase.requirements.map((r) => r.requirement.id)));
  const tree = (records: RecordSummary[], label: string) => (
    <TreeList label={label} items={records} itemKey={(r) => r.id} nestedOf={testsOf} renderRow={(r) => <RecordRowBody index={index} record={r} />}
      searchText={recordText} countLabel={(_, tests) => nestedCount(index, tests)} nestedLabel={(r) => `Use case tests of ${r.id}`} />
  );
  return (
    <Section title="UC requirements" count={useCase.requirements.length} className="use-case-requirements">
      {groups.map((g) => (g.heading === null
        ? <div key="">{tree(g.records, `UC requirements of ${useCase.useCase.id}`)}</div>
        : <Section key={g.key} title={g.heading} count={g.records.length} level={3} className="record-group">{tree(g.records, `${g.heading}: UC requirements of ${useCase.useCase.id}`)}</Section>))}
    </Section>
  );
}

/** An interface's kind, when its name does not say it, from the Product read model's list of interfaces. */
function InterfaceKind({ index, id }: { index: RecordIndex; id: string }) {
  const read = useInterfaces(index.product, index);
  const iface = read.state === 'read' ? read.answer.find((i) => i.id === id) : undefined;
  return iface && !saysKind(iface) ? <small className="meta" data-meta="interface-kind">{iface.kind}</small> : null;
}

/** The use case's flow, the same through every interface, and the interfaces that offer it. */
function FlowAndInterfaces({ index, useCase }: { index: RecordIndex; useCase: UseCaseRead }) {
  const flow = useCase.flows[0];
  if (!flow) return null;
  const offering = flow.through.map((t) => t.interface);
  return (
    <Section title="Flow" count={1} className="use-case-flow">
      <Rows index={index} ids={[flow.flow.id]} label={`Flow of ${useCase.useCase.id}`} />
      <Section title="Offered through" count={offering.length} level={3} className="use-case-interfaces">
        {offering.length === 0 ? <p className="hint">No interface offers it yet.</p> : (
          <ul className="plain record-list" aria-label={`Interfaces that offer ${useCase.useCase.id}`}>
            {offering.map((i) => (
              <li key={i}><div className="record-row"><RecordLink index={index} id={i} row /><span className="row-tags"><InterfaceKind index={index} id={i} /></span></div></li>
            ))}
          </ul>
        )}
      </Section>
    </Section>
  );
}

/** A text of the record, read as Markdown with the IDs it names as links, under its heading or as the page's lead. */
function Text({ index, id, source, title, field }: { index: RecordIndex; id: string; source: string | undefined; title?: string; field: string }) {
  if (!source?.trim()) return null;
  const prose = <Prose index={index} source={source} self={id} />;
  return title ? <Section title={title} className={`record-${field}`}>{prose}</Section> : <div className="record-lead" data-field={field}>{prose}</div>;
}

/** Short facts of the record, as a definition list. */
function Facts({ facts }: { facts: { label: string; value: ReactNode }[] }) {
  if (facts.length === 0) return null;
  return <dl className="fields use-case-facts">{facts.map((f) => <div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}</dl>;
}

/** The "In journeys" fact: where the use case sits in time, each journey it is a step of; none when it is in none. */
const inJourneys = (index: RecordIndex, useCase: UseCaseRead): { label: string; value: ReactNode }[] =>
  useCase.journeys.length ? [{ label: 'In journeys', value: <InJourneys index={index} journeys={useCase.journeys} id={useCase.useCase.id} /> }] : [];

/** What one record of the use case shows on its page, by the kind it is in the use case. */
function Content({ index, useCase, id, kind }: { index: RecordIndex; useCase: UseCaseRead; id: string; kind: UseCaseKind }) {
  switch (kind) {
    case 'use_case':
      return (
        <>
          <Text index={index} id={id} source={useCase.useCase.goal} field="goal" />
          <Facts facts={[
            ...(useCase.actors.length ? [{ label: useCase.actors.length === 1 ? 'Actor' : 'Actors', value: useCase.actors.join(', ') }] : []),
            ...inJourneys(index, useCase),
          ]} />
          <Text index={index} id={id} source={useCase.useCase.notes} title="Notes" field="notes" />
          <FlowAndInterfaces index={index} useCase={useCase} />
          <Requirements index={index} useCase={useCase} />
        </>
      );
    case 'uc_requirement': {
      const { requirement, tests: tested, fulfilledBy } = useCase.requirements.find((r) => r.requirement.id === id)!;
      const tests = tested.map((t) => t.test.id);
      return (
        <>
          <Text index={index} id={id} source={requirement.statement} field="statement" />
          <Facts facts={requirement.group_name ? [{ label: 'Group', value: requirement.group_name }] : []} />
          <Section title="Fulfilled by" count={fulfilledBy.length} className="fulfilled-by">
            {fulfilledBy.length === 0 ? <p className="hint">No step of its use case fulfills it yet.</p> : <Rows index={index} ids={fulfilledBy} label={`Steps that fulfill ${id}`} />}
          </Section>
          {tests.length > 0 && <Section title="Use case tests" count={tests.length}><Rows index={index} ids={tests} label={`Use case tests of ${id}`} /></Section>}
        </>
      );
    }
    case 'flow': {
      const flow = useCase.flows.find((f) => f.flow.id === id)!;
      const { test } = flow;
      return (
        <>
          <FlowInterfaces key={id} index={index} flow={flow} />
          {test && <Section title="Flow test" count={1}><Rows index={index} ids={[test.test.id]} label={`Flow test of ${id}`} /></Section>}
        </>
      );
    }
    case 'flow_step': {
      const step = useCase.flows.flatMap(stepsOf).find((s) => s.step.id === id)!;
      const links: { label: string; words: string; ids: string[] }[] = [
        { label: 'Invokes', words: 'invokes', ids: step.invokes ? [step.invokes] : [] },
        { label: 'Fulfills', words: 'fulfills', ids: step.fulfills },
        { label: 'Exchanges with', words: 'exchanges with', ids: step.exchangesWith },
      ];
      return (
        <>
          <Facts facts={[
            { label: 'Flow', value: <RecordLink index={index} id={step.step.flow_id} /> }, { label: 'Path', value: step.step.path }, { label: 'Position', value: step.step.position },
            ...(step.step.interface_id ? [{ label: 'Only in', value: <RecordLink index={index} id={step.step.interface_id} /> }] : []),
          ]} />
          {links.filter((l) => l.ids.length > 0).map((l) => (
            <Section key={l.label} title={l.label} count={l.ids.length} level={3}><Rows index={index} ids={l.ids} label={`${id} ${l.words}`} /></Section>
          ))}
          {links.every((l) => l.ids.length === 0) && <p className="hint">The step links to nothing.</p>}
        </>
      );
    }
    case 'use_case_test': {
      const { test: row, startsFrom } = useCase.requirements.flatMap((r) => r.tests).find((t) => t.test.id === id)!;
      return (
        <>
          {/* A scenario's parts as the data holds them: a test loaded from a file may still lack one. */}
          {(row.when || row.then) && (
            <dl className="scenario" aria-label="Scenario">
              {row.when && <div data-field="when"><dt>When</dt><dd><Prose index={index} source={row.when} self={id} /></dd></div>}
              {row.then && <div data-field="then"><dt>Then</dt><dd><Prose index={index} source={row.then} self={id} /></dd></div>}
            </dl>
          )}
          <Text index={index} id={id} source={row.notes} title="Notes" field="notes" />
          <StartsFrom index={index} id={id} sets={startsFrom} />
        </>
      );
    }
    case 'flow_test': {
      const { test: row, startsFrom } = useCase.flows.find((f) => f.test?.test.id === id)!.test!;
      return (
        <>
          {(row.steps ?? []).length > 0 && (
            <Section title="Steps" count={row.steps.length}>
              <ol className="test-steps">{row.steps.map((s, i) => <li key={i}><Prose index={index} source={s} self={id} /></li>)}</ol>
            </Section>
          )}
          <Text index={index} id={id} source={row.expected_result} title="Expected result" field="expected_result" />
          <Text index={index} id={id} source={row.notes} title="Notes" field="notes" />
          <StartsFrom index={index} id={id} sets={startsFrom} />
        </>
      );
    }
  }
}

function StartsFrom({ index, id, sets }: { index: RecordIndex; id: string; sets: string[] }) {
  if (sets.length === 0) return null;
  return <Section title="Starts from" count={sets.length} level={3}><Rows index={index} ids={sets} label={`Test data sets ${id} starts from`} /></Section>;
}

/** The record's summary in the wiki card: its lead text and a few key facts. */
function Summary({ index, useCase, id, kind }: { index: RecordIndex; useCase: UseCaseRead; id: string; kind: UseCaseKind }) {
  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const { lead, facts } = ((): { lead?: string; facts: { label: string; value: ReactNode }[] } => {
    switch (kind) {
      case 'use_case':
        return {
          lead: useCase.useCase.goal,
          facts: [
            { label: 'Capability', value: <RecordLink index={index} id={useCase.useCase.capability_id} /> },
            ...(useCase.actors.length ? [{ label: useCase.actors.length === 1 ? 'Actor' : 'Actors', value: useCase.actors.join(', ') }] : []),
            { label: 'Holds', value: `${useCase.flows.length ? 'its flow' : 'no flow'}, ${count(useCase.requirements.length, 'UC requirement', 'UC requirements')}` },
            ...inJourneys(index, useCase),
          ],
        };
      case 'uc_requirement': {
        const { requirement } = useCase.requirements.find((r) => r.requirement.id === id)!;
        return { lead: requirement.statement, facts: [{ label: 'Use case', value: <RecordLink index={index} id={useCase.useCase.id} /> }, ...(requirement.group_name ? [{ label: 'Group', value: requirement.group_name }] : [])] };
      }
      case 'flow': {
        const flow = useCase.flows.find((f) => f.flow.id === id)!;
        return { facts: [{ label: 'Use case', value: <RecordLink index={index} id={useCase.useCase.id} /> }, { label: 'Offered through', value: count(flow.through.length, 'interface', 'interfaces') }, { label: 'Steps', value: stepsOf(flow).length }] };
      }
      case 'flow_step': {
        const step = useCase.flows.flatMap(stepsOf).find((s) => s.step.id === id)!;
        return { facts: [{ label: 'Flow', value: <RecordLink index={index} id={step.step.flow_id} /> }, { label: 'Path', value: `${step.step.path}, step ${step.step.position}` }, ...(step.invokes ? [{ label: 'Invokes', value: <RecordLink index={index} id={step.invokes} /> }] : [])] };
      }
      case 'use_case_test': {
        const { test } = useCase.requirements.flatMap((r) => r.tests).find((t) => t.test.id === id)!;
        return { lead: test.when, facts: [{ label: 'Proves', value: <RecordLink index={index} id={test.uc_requirement_id} /> }, { label: 'Level', value: test.level }, { label: 'State', value: test.state }] };
      }
      case 'flow_test': {
        const { test } = useCase.flows.find((f) => f.test?.test.id === id)!.test!;
        return { facts: [{ label: 'Proves', value: <RecordLink index={index} id={test.flow_id} /> }, { label: 'Level', value: test.level }, { label: 'State', value: test.state }] };
      }
    }
  })();
  return (
    <>
      {lead && <div className="wiki-panel-lead"><Markdown source={lead} /></div>}
      <Facts facts={facts} />
    </>
  );
}

/** A record of a use case: its page (or its summary in the wiki card), with its editor's actions. */
export function UseCasePage({ index, id, summary = false, after }: AggregatePageProps) {
  const read = useUseCase(id, index);
  const record = index.byId.get(id);
  const body = summary ? 'spec-body wiki-panel-summary' : 'spec-body';
  if (!record) return <div className={body}><p>There's no record with the ID <code>{id}</code>.</p></div>;
  if (read.state === 'refused') {
    return <div className={body}><Refusal title={`${id} could not be read.`} reasons={read.problems.length ? read.problems.map(problemText) : [read.error]} focusKey={0} /></div>;
  }
  // Until the record's use case is read (the last answer on screen may still be another record's), the page says so.
  const useCase = read.state === 'read' && read.answer.record.id === id ? read.answer : null;
  const kind = useCase?.record.kind;
  if (!useCase || !kind) return <div className={body}><p className="hint" role="status">Reading {id}…</p></div>;
  return (
    <UseCaseEditor index={index} useCase={useCase} id={id} kind={kind}>
      {summary ? (
        <div className={body}><Summary index={index} useCase={useCase} id={id} kind={kind} />{after}</div>
      ) : (
        <div className={body} data-aggregate="use-case">
          <RecordFrame index={index} record={record}><Content index={index} useCase={useCase} id={id} kind={kind} /></RecordFrame>
          {after}
        </div>
      )}
    </UseCaseEditor>
  );
}
