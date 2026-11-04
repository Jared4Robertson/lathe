import type { ApiRequirementOnPage, EndpointPage as Endpoint } from '../../../../lathe/src/interface-design/endpoint/read-model';
import type { AggregatePageProps } from '../../record/pages';
import { Facts, RowsSection, Summary, TestScenario, Text, readState, type Fact } from '../../record/page-parts';
import { RecordLink, Section } from '../../specs/parts';
import { RecordFrame } from '../../specs/RecordContent';
import { type RecordIndex } from '../../exploring/record-summaries/record-index';
import { EndpointEditor } from './EndpointEditor';
import { useEndpoint } from './reads';

// The Endpoint page (LA-IXD-A13's page, LA-V152): any record of an endpoint, at its address (/<id>), drawn from the
// endpoint read whole (GET /api/endpoint/get-endpoint) and changed only through its own commands (EndpointEditor). An
// endpoint shows its description and notes, its handler, and its API requirements in a table under their groups, one
// row each with the endpoint tests that prove it; an API requirement its statement (its Traceability lists Proved by);
// an endpoint handler its description and packages (its Traceability lists the standard rules it meets); an
// endpoint test its scenario and what it starts from. What every record's page holds around that (traceability,
// problems, facts and links) is the Record page's (RecordFrame).

/** The API requirements under their groups: the ungrouped ones first, then each group in the order it first appears. */
function groupsOf(requirements: readonly ApiRequirementOnPage[]): { heading: string | null; requirements: ApiRequirementOnPage[] }[] {
  const groups = new Map<string, { heading: string | null; requirements: ApiRequirementOnPage[] }>();
  for (const r of requirements) {
    const heading = r.requirement.group_name?.trim() || null;
    const key = heading?.toLowerCase() ?? '';
    const group = groups.get(key) ?? { heading, requirements: [] };
    group.requirements.push(r);
    groups.set(key, group);
  }
  return [...groups.entries()].sort(([a], [b]) => (a === '' ? -1 : b === '' ? 1 : 0)).map(([, g]) => g);
}

/** The endpoint's API requirements in a table, one row each under their groups with the tests that prove it. */
function Requirements({ index, page }: { index: RecordIndex; page: Endpoint }) {
  return (
    <Section title="API requirements" count={page.requirements.length} className="endpoint-requirements">
      {page.requirements.length === 0 ? <p className="hint">No API requirements yet.</p> : (
        <div className="table-scroll table-stack">
          <table className="data-table api-requirements" role="table">
            <caption className="sr-only">The API requirements of {page.endpoint.id}, with the tests that prove each one</caption>
            <thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader">Requirement</th><th scope="col" role="columnheader">Proved by</th></tr></thead>
            {groupsOf(page.requirements).map((g) => (
              <tbody key={g.heading ?? ''} data-group={g.heading ?? undefined} role="rowgroup">
                {g.heading !== null && <tr className="group-row" role="row"><th scope="rowgroup" colSpan={2} role="rowheader">{g.heading}</th></tr>}
                {g.requirements.map((r) => (
                  <tr key={r.requirement.id} role="row">
                    <th scope="row" role="rowheader"><RecordLink index={index} id={r.requirement.id} /></th>
                    <td role="cell" data-label="Proved by">
                      {r.tests.length === 0 ? <span className="hint">Nothing yet</span> : (
                        <span className="trace-cell">{r.tests.map((t) => <RecordLink key={t.test.id} index={index} id={t.test.id} showTitle={false} />)}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      )}
    </Section>
  );
}

/** The packages the code uses, as the page shows them (its file is among the record's facts). */
function Packages({ packages }: { packages: readonly string[] }) {
  if (packages.length === 0) return null;
  return (
    <Section title="Packages" count={packages.length} className="record-packages">
      <ul className="plain">{packages.map((p) => <li key={p}><code>{p}</code></li>)}</ul>
    </Section>
  );
}

const requirementOf = (page: Endpoint, id: string) => page.requirements.find((r) => r.requirement.id === id)!;
const testOf = (page: Endpoint, id: string) => page.requirements.flatMap((r) => r.tests).find((t) => t.test.id === id)!;

/** What one record of the endpoint shows on its page, by the kind it is in the endpoint. */
function Content({ index, page }: { index: RecordIndex; page: Endpoint }) {
  const { id, kind } = page.record;
  switch (kind) {
    case 'endpoint':
      return (
        <>
          <Text index={index} id={id} source={page.endpoint.description} field="description" />
          <Facts facts={[{ label: 'Method', value: page.endpoint.method }, { label: 'Route', value: <code>{page.endpoint.route}</code> }]} />
          <Text index={index} id={id} source={page.endpoint.notes} title="Notes" field="notes" />
          <RowsSection index={index} title="Handler" ids={page.handler ? [page.handler.handler.id] : []} label={`The handler of ${id}`} empty="No handler yet." className="endpoint-handler" />
          <Requirements index={index} page={page} />
        </>
      );
    case 'api_requirement':
      return <Text index={index} id={id} source={requirementOf(page, id).requirement.statement} field="statement" />;
    case 'endpoint_handler': {
      const { handler, packages } = page.handler!;
      return <><Text index={index} id={id} source={handler.description} field="description" /><Packages packages={packages} /></>;
    }
    case 'endpoint_test': {
      const { test, startsFrom } = testOf(page, id);
      return <TestScenario index={index} id={id} when={test.when} then={test.then} notes={test.notes} startsFrom={startsFrom} />;
    }
  }
}

/** The record's lead and key facts in the wiki card. */
function summaryOf(index: RecordIndex, page: Endpoint): { lead?: string; facts: Fact[] } {
  const { id, kind } = page.record;
  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const endpoint = { label: 'Endpoint', value: <RecordLink index={index} id={page.endpoint.id} /> };
  switch (kind) {
    case 'endpoint': {
      const row = page.endpoint;
      return {
        lead: row.description,
        facts: [
          { label: 'Exposes', value: <RecordLink index={index} id={row.command_id ?? row.query_id ?? ''} /> },
          { label: 'Method', value: row.method },
          { label: 'Route', value: <code>{row.route}</code> },
          { label: 'Handler', value: page.handler ? <RecordLink index={index} id={page.handler.handler.id} /> : 'None yet' },
          { label: 'Holds', value: count(page.requirements.length, 'API requirement', 'API requirements') },
        ],
      };
    }
    case 'api_requirement': {
      const r = requirementOf(page, id);
      return { lead: r.requirement.statement, facts: [endpoint, ...(r.requirement.group_name ? [{ label: 'Group', value: r.requirement.group_name }] : []), { label: 'Tests', value: r.tests.length }] };
    }
    case 'endpoint_handler': {
      const { handler, packages } = page.handler!;
      return { lead: handler.description, facts: [endpoint, ...(handler.file ? [{ label: 'File', value: <code>{handler.file}</code> }] : []), { label: 'Packages', value: packages.length }] };
    }
    case 'endpoint_test': {
      const { test } = testOf(page, id);
      return { lead: test.when, facts: [{ label: 'Proves', value: <RecordLink index={index} id={test.api_requirement_id} /> }, { label: 'Level', value: test.level }, { label: 'State', value: test.state }] };
    }
  }
}

/** A record of an endpoint: its page (or its summary in the wiki card), with its editor's actions. */
export function EndpointPage({ index, id, summary = false, after }: AggregatePageProps) {
  const read = useEndpoint(id, index);
  const state = readState(index, id, read, (answer) => answer.record.id === id, summary);
  if ('shown' in state) return state.shown;
  const page = state.answer;
  const body = summary ? 'spec-body wiki-panel-summary' : 'spec-body';
  return (
    <EndpointEditor index={index} page={page}>
      {summary ? (
        <div className={body}><Summary {...summaryOf(index, page)} />{after}</div>
      ) : (
        <div className={body} data-aggregate="endpoint">
          <RecordFrame index={index} record={index.byId.get(id)!}><Content index={index} page={page} /></RecordFrame>
          {after}
        </div>
      )}
    </EndpointEditor>
  );
}
