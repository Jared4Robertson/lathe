import type { DomainPage as Domain } from '../../../../lathe/src/authoring/domain/read-model';
import type { AggregatePageProps } from '../../record/pages';
import { RowsSection, Summary, TestScenario, Text, readState, type Fact } from '../../record/page-parts';
import type { SpecIndex } from '../../specs/data';
import { RecordLink } from '../../specs/parts';
import { RecordFrame } from '../../specs/RecordContent';
import { RecordedExceptions } from '../../specs/RecordText';
import { DomainWiki } from '../../specs/SpecPages';
import { DomainEditor } from './DomainEditor';
import { useDomain } from './reads';

// The Domain page (LA-AUT-A4's page, LA-V120): any record of a domain, at its address (/<id>), drawn from the domain
// read whole (GET /api/domain/get-domain) and changed only through its own commands (DomainEditor). The domain itself
// shows its wiki (its records in the nav's stages and folders, the patterns it follows, coverage and problems); a
// capability its description, position and use cases (what it serves is in its Traceability); a term its meaning; a
// domain service its statement, its service and its tests; a service its file and packages; a repository its
// description, the aggregate it persists, its file and packages; a domain service test its scenario. What every
// record's page holds around that (traceability, problems, facts and links) is the Record page's (RecordFrame).

const capabilityOf = (page: Domain, id: string) => page.capabilities.find((c) => c.capability.id === id)!;
const termOf = (page: Domain, id: string) => page.terms.find((t) => t.term.id === id)!.term;
const domainServiceOf = (page: Domain, id: string) => page.domainServices.find((s) => s.domainService.id === id)!;
const serviceOf = (page: Domain, id: string) => page.domainServices.find((s) => s.service?.service.id === id)!;
const testOf = (page: Domain, id: string) => page.domainServices.flatMap((s) => s.tests).find((t) => t.test.id === id)!;
const repositoryOf = (page: Domain, id: string) => page.repositories.find((r) => r.repository.id === id)!;

/** A technical record's file and packages, as facts. */
const technicalFacts = (file: string | undefined, packages: readonly string[]): Fact[] => [
  ...(file ? [{ label: 'File', value: <code>{file}</code> }] : []),
  ...(packages.length ? [{ label: 'Packages', value: packages.join(', ') }] : []),
];

/** What one record of the domain shows on its page, by the kind it is in the domain (the domain itself has its wiki). */
function Content({ index, page }: { index: SpecIndex; page: Domain }) {
  const { id, kind } = page.record;
  switch (kind) {
    case 'domain':
      return null;
    case 'capability': {
      const c = capabilityOf(page, id);
      return (
        <>
          <Text index={index} id={id} source={c.capability.description} field="description" />
          <RowsSection index={index} title="Use cases" ids={c.useCases} label={`Use cases of ${id}`} empty="No use case under this capability yet." className="capability-use-cases" />
        </>
      );
    }
    case 'term': {
      const t = termOf(page, id);
      return <Text index={index} id={id} source={t.meaning} field="meaning" />;
    }
    case 'domain_service': {
      const s = domainServiceOf(page, id);
      return (
        <>
          <Text index={index} id={id} source={s.domainService.statement} field="statement" />
          <RowsSection index={index} title="Service" ids={s.service ? [s.service.service.id] : []} label={`Service of ${id}`} empty="No service implements it yet." />
          <RowsSection index={index} title="Domain service tests" ids={s.tests.map((t) => t.test.id)} label={`Tests of ${id}`} empty="No test proves it yet." />
        </>
      );
    }
    case 'service':
      // A service is its file and the standard rules and packages it meets and uses: all in its facts and links.
      return null;
    case 'domain_service_test': {
      const { test, startsFrom } = testOf(page, id);
      return <TestScenario index={index} id={id} when={test.when} then={test.then} notes={test.notes} startsFrom={startsFrom} />;
    }
    case 'repository': {
      const r = repositoryOf(page, id);
      return (
        <>
          <Text index={index} id={id} source={r.repository.description} field="description" />
          {r.alsoPersists.length > 0 && (
            <RecordedExceptions index={index} rows={r.alsoPersists.map((s) => ({ aggregate_id: s.aggregate, reason: s.reason }))} owner={id} title="Also persists"
              hint="A recorded exception to one repository per aggregate: each has no repository of its own, and the checks list it so it stays deliberate." />
          )}
        </>
      );
    }
  }
}

/** The record's lead and key facts in the wiki card. */
function summaryOf(index: SpecIndex, page: Domain): { lead?: string; facts: Fact[] } {
  const { id, kind } = page.record;
  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const inDomain: Fact = { label: 'Domain', value: <RecordLink index={index} id={page.domain.id} /> };
  switch (kind) {
    case 'domain':
      return {
        lead: page.domain.description,
        facts: [
          { label: 'Product', value: <RecordLink index={index} id={page.domain.product_id} /> },
          { label: 'Subdomain', value: page.domain.subdomain_type },
          { label: 'Holds', value: `${count(page.capabilities.length, 'capability', 'capabilities')}, ${count(page.terms.length, 'term', 'terms')}` },
        ],
      };
    case 'capability': {
      const c = capabilityOf(page, id);
      return { lead: c.capability.description, facts: [inDomain, { label: 'Use cases', value: c.useCases.length }, { label: 'Serves', value: count(c.serves.length, 'outcome', 'outcomes') }] };
    }
    case 'term': {
      const t = termOf(page, id);
      return { lead: t.meaning, facts: [inDomain, ...(t.group_name ? [{ label: 'Group', value: t.group_name }] : [])] };
    }
    case 'domain_service': {
      const s = domainServiceOf(page, id);
      return { lead: s.domainService.statement, facts: [inDomain, { label: 'Service', value: s.service ? <RecordLink index={index} id={s.service.service.id} /> : 'none yet' }, { label: 'Tests', value: s.tests.length }] };
    }
    case 'service': {
      const s = serviceOf(page, id);
      return { facts: [{ label: 'Domain service', value: <RecordLink index={index} id={s.domainService.id} /> }, ...technicalFacts(s.service!.service.file, s.service!.packages)] };
    }
    case 'domain_service_test': {
      const { test } = testOf(page, id);
      return { lead: test.when, facts: [{ label: 'Proves', value: <RecordLink index={index} id={test.domain_service_id} /> }, { label: 'Level', value: test.level }, { label: 'State', value: test.state }] };
    }
    case 'repository': {
      const r = repositoryOf(page, id);
      return { lead: r.repository.description, facts: [inDomain, { label: 'Persists', value: r.persists ? <RecordLink index={index} id={r.persists} /> : 'none yet' }, ...technicalFacts(r.repository.file, [])] };
    }
  }
}

/** A record of a domain: its page (or its summary in the wiki card), with its editor's actions. */
export function DomainPage({ index, id, summary = false, after }: AggregatePageProps) {
  const read = useDomain(id, index);
  const state = readState(index, id, read, (answer) => answer.record.id === id, summary);
  if ('shown' in state) return state.shown;
  const page = state.answer;
  const body = summary ? 'spec-body wiki-panel-summary' : 'spec-body';
  return (
    <DomainEditor index={index} page={page}>
      {summary ? (
        <div className={body}><Summary {...summaryOf(index, page)} />{after}</div>
      ) : page.record.kind === 'domain' ? (
        <div data-aggregate="domain"><DomainWiki index={index} id={id} />{after}</div>
      ) : (
        <div className={body} data-aggregate="domain">
          <RecordFrame index={index} record={index.byId.get(id)!}><Content index={index} page={page} /></RecordFrame>
          {after}
        </div>
      )}
    </DomainEditor>
  );
}
