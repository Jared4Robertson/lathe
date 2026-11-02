import type { CommandPage as Command } from '../../../../lathe/src/authoring/command/read-model';
import { plural } from '../../plural';
import type { AggregatePageProps } from '../../record/pages';
import { Facts, RowsSection, Summary, TestScenario, Text, readState, type Fact } from '../../record/page-parts';
import { kindLabel, type RecordIndex } from '../../exploring/record-summaries/record-index';
import { RecordLink } from '../../specs/parts';
import { RecordFrame } from '../../specs/RecordContent';
import { InJourneys } from '../journey/InJourneys';
import { CommandEditor } from './CommandEditor';
import { useCommand } from './reads';

// The Command page (LA-AUT-A8's page, LA-V132): any record of a command, at its address (/<id>), drawn from the
// command read whole (GET /api/command/get-command) and changed only through its own commands (CommandEditor). The
// command shows its description, its handler, its policies and the endpoints that expose it (with their method and
// route) and the other aggregates it also changes, each with its reason; what it raises, checks and calls are in its
// Traceability. A policy shows its statement, its event handler and
// its test (the event it hears is in its Traceability); a handler its description; a policy test its scenario. What
// every record's page holds around that (traceability, problems, facts and links) is the Record page's (RecordFrame).

/** A list of one kind is titled by that kind's plural label (LA-V92-R09). */
const titleOf = (index: RecordIndex, kind: string) => plural(kindLabel(index, kind));

const policyOf = (page: Command, id: string) => page.policies.find((p) => p.policy.id === id || p.eventHandler?.handler.id === id || p.test?.test.id === id)!;

/** The "In journeys" fact of a policy: the journeys it is a handoff in; none when it is in none. */
const inJourneys = (index: RecordIndex, p: Command['policies'][number]): Fact[] =>
  p.journeys.length ? [{ label: 'In journeys', value: <InJourneys index={index} journeys={p.journeys} id={p.policy.id} /> }] : [];

/** What one record of the command shows on its page, by the kind it is in the command. */
function Content({ index, page }: { index: RecordIndex; page: Command }) {
  const { id, kind } = page.record;
  switch (kind) {
    case 'command':
      return (
        <>
          <Text index={index} id={id} source={page.command.description} field="description" />
          <RowsSection index={index} title={titleOf(index, 'command_handler')} ids={page.handler ? [page.handler.handler.id] : []} label={`${titleOf(index, 'command_handler')} of ${id}`} empty="No handler carries it out yet." />
          <RowsSection index={index} title={titleOf(index, 'policy')} ids={page.policies.map((p) => p.policy.id)} label={`${titleOf(index, 'policy')} of ${id}`} empty="No policy sends it." />
          <RowsSection index={index} title={titleOf(index, 'endpoint')} ids={page.endpoints} label={`${titleOf(index, 'endpoint')} of ${id}`} empty="No endpoint exposes it." className="command-endpoints" />
        </>
      );
    case 'command_handler':
      return <Text index={index} id={id} source={page.handler!.handler.description} field="description" />;
    case 'policy': {
      const p = policyOf(page, id);
      return (
        <>
          <Text index={index} id={id} source={p.policy.statement} field="statement" />
          <Facts facts={inJourneys(index, p)} />
          <RowsSection index={index} title={titleOf(index, 'event_handler')} ids={p.eventHandler ? [p.eventHandler.handler.id] : []} label={`${titleOf(index, 'event_handler')} of ${id}`} empty="No event handler carries it out yet." />
          <RowsSection index={index} title={titleOf(index, 'policy_test')} ids={p.test ? [p.test.test.id] : []} label={`${titleOf(index, 'policy_test')} of ${id}`} empty="No test proves it yet." />
        </>
      );
    }
    case 'event_handler':
      return <Text index={index} id={id} source={policyOf(page, id).eventHandler!.handler.description} field="description" />;
    case 'policy_test': {
      const { test, startsFrom } = policyOf(page, id).test!;
      return <TestScenario index={index} id={id} when={test.when} then={test.then} notes={test.notes} startsFrom={startsFrom} />;
    }
  }
}

/** A handler's file and packages, as facts. */
const technicalFacts = (file: string | undefined, packages: readonly string[]): Fact[] => [
  ...(file ? [{ label: 'File', value: <code>{file}</code> }] : []),
  ...(packages.length ? [{ label: 'Packages', value: packages.join(', ') }] : []),
];

/** The record's lead and key facts in the wiki card. */
function summaryOf(index: RecordIndex, page: Command): { lead?: string; facts: Fact[] } {
  const { id, kind } = page.record;
  const ofCommand: Fact = { label: 'Command', value: <RecordLink index={index} id={page.command.id} /> };
  switch (kind) {
    case 'command':
      return {
        lead: page.command.description,
        facts: [
          { label: 'Entity', value: <RecordLink index={index} id={page.command.entity_id} /> },
          { label: 'Raises', value: page.raises.length },
          { label: 'Handler', value: page.handler ? <RecordLink index={index} id={page.handler.handler.id} /> : 'none yet' },
          { label: 'Policies', value: page.policies.length },
        ],
      };
    case 'command_handler':
      return { lead: page.handler!.handler.description, facts: [ofCommand, ...technicalFacts(page.handler!.handler.file, page.handler!.packages)] };
    case 'policy': {
      const p = policyOf(page, id);
      const exchanges: Fact[] = p.exchangesWith.length
        ? [{ label: 'Exchanges with', value: <span className="trace-cell">{p.exchangesWith.map((x) => <RecordLink key={x} index={index} id={x} showTitle={false} />)}</span> }]
        : [];
      return { lead: p.policy.statement, facts: [ofCommand, { label: 'Hears', value: p.hears ? <RecordLink index={index} id={p.hears} /> : 'nothing yet' }, ...exchanges, ...inJourneys(index, p)] };
    }
    case 'event_handler': {
      const p = policyOf(page, id);
      return { lead: p.eventHandler!.handler.description, facts: [{ label: 'Policy', value: <RecordLink index={index} id={p.policy.id} /> }, ...technicalFacts(p.eventHandler!.handler.file, p.eventHandler!.packages)] };
    }
    case 'policy_test': {
      const { test } = policyOf(page, id).test!;
      return { lead: test.when, facts: [{ label: 'Proves', value: <RecordLink index={index} id={test.policy_id} /> }, { label: 'Level', value: test.level }, { label: 'State', value: test.state }] };
    }
  }
}

/** A record of a command: its page (or its summary in the wiki card), with its editor's actions. */
export function CommandPage({ index, id, summary = false, after }: AggregatePageProps) {
  const read = useCommand(id, index);
  const state = readState(index, id, read, (answer) => answer.record.id === id, summary);
  if ('shown' in state) return state.shown;
  const page = state.answer;
  return (
    <CommandEditor index={index} page={page}>
      {summary ? (
        <div className="spec-body wiki-panel-summary"><Summary {...summaryOf(index, page)} />{after}</div>
      ) : (
        <div className="spec-body" data-aggregate="command">
          <RecordFrame index={index} record={index.byId.get(id)!}><Content index={index} page={page} /></RecordFrame>
          {after}
        </div>
      )}
    </CommandEditor>
  );
}
