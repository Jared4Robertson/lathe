import type { ReactNode } from 'react';
import { kindInside, type UseCase, type UseCaseKind } from '../../../../lathe/src/authoring/use-case/model';
import { Refusal, problemText } from '../../edit/fields';
import { LongList } from '../../components/LongList';
import { TreeList } from '../../components/TreeList';
import type { AggregatePageProps } from '../../record/pages';
import { Markdown } from '../../specs/Markdown';
import { Prose } from '../../specs/mentions';
import { ProblemBadge, RecordLink, RecordRowBody, Section, nestedCount, recordText } from '../../specs/parts';
import { RecordFrame } from '../../specs/RecordContent';
import { saysKind } from '../../specs/InterfaceParts';
import { groupRecords } from '../../specs/groups';
import type { SpecIndex, SpecRecord } from '../../specs/data';
import { FlowSteps } from './FlowSteps';
import { UseCaseEditor } from './UseCaseEditor';
import { useUseCase } from './reads';

// The Use case page (LA-AUT-A11's page): any record of a use case, drawn from the use case read whole
// (GET /api/use-case/get-use-case) and changed only through its own commands (UseCaseEditor). A use case shows its
// goal, actors and notes, its flows by interface and its UC requirements with their tests; a UC requirement its
// statement, its tests and the steps that fulfill it; a flow the interface it goes through and its steps, path by path
// in step order; a step what it links to; a test its scenario and what it starts from. What every record's page holds
// around that (traceability, problems, facts and links) is the Record page's (RecordFrame); the titles of the records
// it names come from the workspace's index while the other aggregates are read whole.

/** Records of the index, by ID, in the order given; an ID no record has is left out. */
const recordsOf = (index: SpecIndex, ids: readonly string[]) => ids.flatMap((id) => index.byId.get(id) ?? []);

/** Rows that each lead to one record: its row in the shell's look (link, fields, test state, gaps, problems). */
function Rows({ index, ids, label }: { index: SpecIndex; ids: readonly string[]; label: string }) {
  return (
    <LongList label={label} className="record-list" items={recordsOf(index, ids)} itemKey={(r) => r.id} searchText={recordText}
      render={(r) => <RecordRowBody index={index} record={r} />} />
  );
}

/** The use case's UC requirements under their groups, each with its tests folded under it. */
function Requirements({ index, useCase }: { index: SpecIndex; useCase: UseCase }) {
  if (useCase.requirements.length === 0) return null;
  const testsOf = (requirement: SpecRecord) => recordsOf(index, useCase.useCaseTests.filter((t) => t.row.uc_requirement_id === requirement.id).map((t) => t.row.id));
  const groups = groupRecords(recordsOf(index, useCase.requirements.map((r) => r.id)));
  const tree = (records: SpecRecord[], label: string) => (
    <TreeList label={label} items={records} itemKey={(r) => r.id} nestedOf={testsOf} renderRow={(r) => <RecordRowBody index={index} record={r} />}
      searchText={recordText} countLabel={(_, tests) => nestedCount(index, tests)} nestedLabel={(r) => `Use case tests of ${r.id}`} />
  );
  return (
    <Section title="UC requirements" count={useCase.requirements.length} className="use-case-requirements">
      {groups.map((g) => (g.heading === null
        ? <div key="">{tree(g.records, `UC requirements of ${useCase.root}`)}</div>
        : <Section key={g.key} title={g.heading} count={g.records.length} level={3} className="record-group">{tree(g.records, `${g.heading}: UC requirements of ${useCase.root}`)}</Section>))}
    </Section>
  );
}

/** An interface's name, with its kind when the name does not say it. */
function InterfaceTag({ index, id }: { index: SpecIndex; id: string }) {
  const iface = index.byId.get(id);
  if (!iface) return <small className="meta" data-meta="interface">{id}</small>;
  return <small className="meta" data-meta="interface">{saysKind(iface) ? iface.title : `${iface.title} · ${String(iface.row.kind)}`}</small>;
}

/** The use case's flows, one row per flow named by the interface it goes through. */
function FlowsByInterface({ index, useCase }: { index: SpecIndex; useCase: UseCase }) {
  if (useCase.flows.length === 0) return null;
  const flows = [...useCase.flows].sort((a, b) => a.interface_id.localeCompare(b.interface_id));
  return (
    <Section title="Flows by interface" count={flows.length} className="use-case-flows">
      <LongList label={`Flows of ${useCase.root}`} className="record-list flow-list" items={flows} itemKey={(f) => f.id}
        searchText={(f) => `${f.id} ${f.title} ${index.byId.get(f.interface_id)?.title ?? ''}`}
        render={(f) => (
          <div className="record-row">
            <RecordLink index={index} id={f.id} row />
            <span className="row-tags">
              <InterfaceTag index={index} id={f.interface_id} />
              <ProblemBadge problems={index.problemsFor.get(f.id) ?? []} />
            </span>
          </div>
        )} />
    </Section>
  );
}

/** A text of the record, read as Markdown with the IDs it names as links, under its heading or as the page's lead. */
function Text({ index, id, source, title, field }: { index: SpecIndex; id: string; source: string | undefined; title?: string; field: string }) {
  if (!source?.trim()) return null;
  const prose = <Prose index={index} source={source} self={id} />;
  return title ? <Section title={title} className={`record-${field}`}>{prose}</Section> : <div className="record-lead" data-field={field}>{prose}</div>;
}

/** Short facts of the record, as a definition list. */
function Facts({ facts }: { facts: { label: string; value: ReactNode }[] }) {
  if (facts.length === 0) return null;
  return <dl className="fields use-case-facts">{facts.map((f) => <div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}</dl>;
}

/** What one record of the use case shows on its page, by the kind it is in the use case. */
function Content({ index, useCase, id, kind }: { index: SpecIndex; useCase: UseCase; id: string; kind: UseCaseKind }) {
  switch (kind) {
    case 'use_case':
      return (
        <>
          <Text index={index} id={id} source={useCase.useCase.goal} field="goal" />
          <Facts facts={useCase.actors.length ? [{ label: useCase.actors.length === 1 ? 'Actor' : 'Actors', value: useCase.actors.join(', ') }] : []} />
          <Text index={index} id={id} source={useCase.useCase.notes} title="Notes" field="notes" />
          <FlowsByInterface index={index} useCase={useCase} />
          <Requirements index={index} useCase={useCase} />
        </>
      );
    case 'uc_requirement': {
      const requirement = useCase.requirements.find((r) => r.id === id)!;
      const fulfilledBy = useCase.steps.filter((s) => s.fulfills.includes(id)).map((s) => s.row.id);
      const tests = useCase.useCaseTests.filter((t) => t.row.uc_requirement_id === id).map((t) => t.row.id);
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
      const flow = useCase.flows.find((f) => f.id === id)!;
      const iface = index.byId.get(flow.interface_id);
      const test = useCase.flowTests.find((t) => t.row.flow_id === id);
      return (
        <>
          <p className="flow-interface">
            Through <RecordLink index={index} id={flow.interface_id} />
            {iface && !saysKind(iface) && <> <small className="meta">{String(iface.row.kind)}</small></>}
          </p>
          <FlowSteps index={index} flow={id} steps={useCase.steps.filter((s) => s.row.flow_id === id)} />
          {test && <Section title="Flow test" count={1}><Rows index={index} ids={[test.row.id]} label={`Flow test of ${id}`} /></Section>}
        </>
      );
    }
    case 'flow_step': {
      const step = useCase.steps.find((s) => s.row.id === id)!;
      const links: { label: string; ids: string[] }[] = [
        { label: 'Invokes', ids: step.invokes ? [step.invokes] : [] },
        { label: 'Happens in', ids: step.happensIn ? [step.happensIn] : [] },
        { label: 'Fulfills', ids: step.fulfills },
        { label: 'Exchanges with', ids: step.exchangesWith },
      ];
      return (
        <>
          <Facts facts={[{ label: 'Flow', value: <RecordLink index={index} id={step.row.flow_id} /> }, { label: 'Path', value: step.row.path }, { label: 'Position', value: step.row.position }]} />
          {links.filter((l) => l.ids.length > 0).map((l) => (
            <Section key={l.label} title={l.label} count={l.ids.length} level={3}><Rows index={index} ids={l.ids} label={`${id} ${l.label.toLowerCase()}`} /></Section>
          ))}
          {links.every((l) => l.ids.length === 0) && <p className="hint">The step links to nothing.</p>}
        </>
      );
    }
    case 'use_case_test': {
      const test = useCase.useCaseTests.find((t) => t.row.id === id)!;
      return (
        <>
          <dl className="scenario" aria-label="Scenario">
            <div data-field="when"><dt>When</dt><dd><Prose index={index} source={test.row.when} self={id} /></dd></div>
            <div data-field="then"><dt>Then</dt><dd><Prose index={index} source={test.row.then} self={id} /></dd></div>
          </dl>
          <Text index={index} id={id} source={test.row.notes} title="Notes" field="notes" />
          <StartsFrom index={index} id={id} sets={test.startsFrom} />
        </>
      );
    }
    case 'flow_test': {
      const test = useCase.flowTests.find((t) => t.row.id === id)!;
      return (
        <>
          <Section title="Steps" count={test.row.steps.length}>
            <ol className="test-steps">{test.row.steps.map((s, i) => <li key={i}><Prose index={index} source={s} self={id} /></li>)}</ol>
          </Section>
          <Text index={index} id={id} source={test.row.expected_result} title="Expected result" field="expected_result" />
          <Text index={index} id={id} source={test.row.notes} title="Notes" field="notes" />
          <StartsFrom index={index} id={id} sets={test.startsFrom} />
        </>
      );
    }
  }
}

function StartsFrom({ index, id, sets }: { index: SpecIndex; id: string; sets: string[] }) {
  if (sets.length === 0) return null;
  return <Section title="Starts from" count={sets.length} level={3}><Rows index={index} ids={sets} label={`Test data sets ${id} starts from`} /></Section>;
}

/** The record's summary in the wiki card: its lead text and a few key facts. */
function Summary({ index, useCase, id, kind }: { index: SpecIndex; useCase: UseCase; id: string; kind: UseCaseKind }) {
  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const { lead, facts } = ((): { lead?: string; facts: { label: string; value: ReactNode }[] } => {
    switch (kind) {
      case 'use_case':
        return {
          lead: useCase.useCase.goal,
          facts: [
            { label: 'Capability', value: <RecordLink index={index} id={useCase.useCase.capability_id} /> },
            ...(useCase.actors.length ? [{ label: useCase.actors.length === 1 ? 'Actor' : 'Actors', value: useCase.actors.join(', ') }] : []),
            { label: 'Holds', value: `${count(useCase.flows.length, 'flow', 'flows')}, ${count(useCase.requirements.length, 'UC requirement', 'UC requirements')}` },
          ],
        };
      case 'uc_requirement': {
        const requirement = useCase.requirements.find((r) => r.id === id)!;
        return { lead: requirement.statement, facts: [{ label: 'Use case', value: <RecordLink index={index} id={useCase.root} /> }, ...(requirement.group_name ? [{ label: 'Group', value: requirement.group_name }] : [])] };
      }
      case 'flow': {
        const flow = useCase.flows.find((f) => f.id === id)!;
        return { facts: [{ label: 'Use case', value: <RecordLink index={index} id={useCase.root} /> }, { label: 'Through', value: <RecordLink index={index} id={flow.interface_id} /> }, { label: 'Steps', value: useCase.steps.filter((s) => s.row.flow_id === id).length }] };
      }
      case 'flow_step': {
        const step = useCase.steps.find((s) => s.row.id === id)!;
        return { facts: [{ label: 'Flow', value: <RecordLink index={index} id={step.row.flow_id} /> }, { label: 'Path', value: `${step.row.path}, step ${step.row.position}` }, ...(step.invokes ? [{ label: 'Invokes', value: <RecordLink index={index} id={step.invokes} /> }] : [])] };
      }
      case 'use_case_test': {
        const test = useCase.useCaseTests.find((t) => t.row.id === id)!;
        return { lead: test.row.when, facts: [{ label: 'Proves', value: <RecordLink index={index} id={test.row.uc_requirement_id} /> }, { label: 'Level', value: test.row.level }, { label: 'State', value: test.row.state }] };
      }
      case 'flow_test': {
        const test = useCase.flowTests.find((t) => t.row.id === id)!;
        return { facts: [{ label: 'Proves', value: <RecordLink index={index} id={test.row.flow_id} /> }, { label: 'Level', value: test.row.level }, { label: 'State', value: test.row.state }] };
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
  // Until the use case is read (or while the read is of data before the record was added), the page says so.
  const useCase = read.state === 'read' ? read.answer : null;
  const kind = useCase ? kindInside(useCase, id) : undefined;
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
