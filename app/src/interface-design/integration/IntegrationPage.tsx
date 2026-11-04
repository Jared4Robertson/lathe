import type { IntegrationPage as Integration } from '../../../../lathe/src/interface-design/integration/read-model';
import type { AggregatePageProps } from '../../record/pages';
import { Facts, RowsSection, Summary, TestScenario, Text, readState, type Fact } from '../../record/page-parts';
import { RecordLink, Section } from '../../specs/parts';
import { RecordFrame } from '../../specs/RecordContent';
import { type RecordIndex } from '../../exploring/record-summaries/record-index';
import { IntegrationEditor } from './IntegrationEditor';
import { useIntegration } from './reads';

// The Integration page (LA-IXD-A14's page, LA-V153): any record of an integration, at its address (/<id>), drawn from
// the integration read whole (GET /api/integration/get-integration) and changed only through its own commands
// (IntegrationEditor). An integration shows its description, the use cases it performs on its own, its adapter and its
// integration tests; an adapter its description and packages (its Traceability lists the standard rules it meets); an
// integration test its scenario and what it starts from. What every record's page holds around that (traceability with the flow steps that exchange
// with it, problems, facts with its outside system, and links) is the Record page's (RecordFrame).

/** The packages the code uses, as the page shows them (its file is among the record's facts). */
function Packages({ packages }: { packages: readonly string[] }) {
  if (packages.length === 0) return null;
  return (
    <Section title="Packages" count={packages.length} className="record-packages">
      <ul className="plain">{packages.map((p) => <li key={p}><code>{p}</code></li>)}</ul>
    </Section>
  );
}

const testOf = (page: Integration, id: string) => page.tests.find((t) => t.test.id === id)!;

/** What one record of the integration shows on its page, by the kind it is in the integration. */
function Content({ index, page }: { index: RecordIndex; page: Integration }) {
  const { id, kind } = page.record;
  switch (kind) {
    case 'integration':
      return (
        <>
          <Text index={index} id={id} source={page.integration.description} field="description" />
          <Facts facts={page.integration.system ? [{ label: 'System', value: page.integration.system }] : []} />
          <RowsSection index={index} title="Performs" ids={page.performs} label={`The use cases ${id} performs`} empty="It performs no use case on its own." className="integration-performs" />
          <RowsSection index={index} title="Adapter" ids={page.adapter ? [page.adapter.adapter.id] : []} label={`The adapter of ${id}`} empty="No adapter yet." className="integration-adapter" />
          <RowsSection index={index} title="Integration tests" ids={page.tests.map((t) => t.test.id)} label={`The integration tests of ${id}`} empty="No integration tests yet." className="integration-tests" />
        </>
      );
    case 'adapter': {
      const { adapter, packages } = page.adapter!;
      return <><Text index={index} id={id} source={adapter.description} field="description" /><Packages packages={packages} /></>;
    }
    case 'integration_test': {
      const { test, startsFrom } = testOf(page, id);
      return <TestScenario index={index} id={id} when={test.when} then={test.then} notes={test.notes} startsFrom={startsFrom} />;
    }
  }
}

/** The record's lead and key facts in the wiki card. */
function summaryOf(index: RecordIndex, page: Integration): { lead?: string; facts: Fact[] } {
  const { id, kind } = page.record;
  const integration = { label: 'Integration', value: <RecordLink index={index} id={page.integration.id} /> };
  switch (kind) {
    case 'integration': {
      const row = page.integration;
      return {
        lead: row.description,
        facts: [
          ...(row.system ? [{ label: 'System', value: row.system }] : []),
          { label: 'Adapter', value: page.adapter ? <RecordLink index={index} id={page.adapter.adapter.id} /> : 'None yet' },
          { label: 'Tests', value: page.tests.length },
        ],
      };
    }
    case 'adapter': {
      const { adapter, packages } = page.adapter!;
      return { lead: adapter.description, facts: [integration, ...(adapter.file ? [{ label: 'File', value: <code>{adapter.file}</code> }] : []), { label: 'Packages', value: packages.length }] };
    }
    case 'integration_test': {
      const { test } = testOf(page, id);
      return { lead: test.when, facts: [{ label: 'Proves', value: <RecordLink index={index} id={test.integration_id} /> }, { label: 'Level', value: test.level }, { label: 'State', value: test.state }] };
    }
  }
}

/** A record of an integration: its page (or its summary in the wiki card), with its editor's actions. */
export function IntegrationPage({ index, id, summary = false, after }: AggregatePageProps) {
  const read = useIntegration(id, index);
  const state = readState(index, id, read, (answer) => answer.record.id === id, summary);
  if ('shown' in state) return state.shown;
  const page = state.answer;
  const body = summary ? 'spec-body wiki-panel-summary' : 'spec-body';
  return (
    <IntegrationEditor index={index} page={page}>
      {summary ? (
        <div className={body}><Summary {...summaryOf(index, page)} />{after}</div>
      ) : (
        <div className={body} data-aggregate="integration">
          <RecordFrame index={index} record={index.byId.get(id)!}><Content index={index} page={page} /></RecordFrame>
          {after}
        </div>
      )}
    </IntegrationEditor>
  );
}
