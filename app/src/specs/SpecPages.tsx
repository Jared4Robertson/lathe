import { useState, type ReactNode } from 'react';
import { Link, useLocation } from '../router';
import { useSpaces } from '../shell/spaces';
import { FormatPage } from './FormatPage';
import { RecordMarkdown } from './mentions';
import { DomainPatterns } from './PatternParts';
import { patternsFollowedBy } from './patterns';
import { CoverageBars, EvidencePanel, FitnessPanel, pluralLabel } from './ProductHealth';
import { LongList } from '../components/LongList';
import { PageHeader, ProblemBadge, ProblemList, RecordLink, RecordTree, Section, idText, recordText } from './parts';
import {
  byIdOrder,
  checksPath,
  domainPath,
  kindLabel,
  problemOrder,
  productPath,
  type Problem,
  type SpecIndex,
  type SpecRecord,
  type SpecRoute,
  type SpecState,
} from './data';

export { RecordContent } from './RecordContent';

// The spec pages that are not about one record: the products, the checks and the record format;
// and the wiki content of a product and a domain, which the focus page (app/src/views) shows in
// its Wiki pane beside or instead of the graph.

// ---------- Shared pieces ----------

export function SourceNote({ spec }: { spec: SpecState }) {
  if (spec.source !== 'fixture') return null;
  return (
    <p className="source-note" role="note">
      <strong>Sample data.</strong> This is <code>lathe/fixtures/workspace.sample.json</code>, not your specs
      {spec.sourceReason ? ` (${spec.sourceReason})` : ''}.
    </p>
  );
}

const recordsIn = (index: SpecIndex, predicate: (r: SpecRecord) => boolean) => index.workspace.records.filter(predicate).sort(byIdOrder);

// ---------- Pages ----------

/** The pages without a focus record: Products, Checks, the record format, and unknown addresses. */
export function SpecView({ spec, route }: { spec: SpecState; route: SpecRoute }) {
  const { index } = spec;
  let page: ReactNode;
  if (!index) {
    page = <div className="placeholder"><p>{spec.error ? `Couldn't load the specs: ${spec.error}` : 'Loading specs…'}</p></div>;
  } else if (route.page === 'checks') {
    page = <ChecksPage index={index} />;
  } else if (route.page === 'format') {
    page = <FormatPage hash={window.location.hash} />;
  } else if (route.page === 'specs') {
    page = <SpecsHome index={index} />;
  } else {
    page = <NotFound what="page" />;
  }
  return (
    <main className="spec-page" id="main">
      <SourceNote spec={spec} />
      {spec.error && index && <p className="error">Couldn't reload the specs: {spec.error}</p>}
      {page}
    </main>
  );
}

export function NotFound({ what, id }: { what: string; id?: string }) {
  return (
    <div className="placeholder">
      <p>{id ? <>There's no {what} with the ID <code>{id}</code>.</> : `There's no such ${what}.`} <Link to="/specs">See all products</Link>.</p>
    </div>
  );
}

function SpecsHome({ index }: { index: SpecIndex }) {
  return (
    <div className="spec-body">
      <PageHeader eyebrow="Specs" title="Products" />
      {index.products.length === 0 && <p className="hint">No products yet. Add a <code>product.md</code> under <code>specs/</code>.</p>}
      <div className="cards">
        {index.products.map((p) => (
          <Link key={p.id} to={productPath(p.id)} className="card">
            <code>{p.id}</code>
            <strong>{p.title}</strong>
            <small>{(index.domainsOf.get(p.id) ?? []).length} domains</small>
          </Link>
        ))}
      </div>
    </div>
  );
}

/** The problems in a product's or a domain's records. */
export const problemsUnder = (index: SpecIndex, key: 'product' | 'domain', id: string) =>
  index.workspace.problems.filter((p) => p.record && index.byId.get(p.record)?.[key] === id);

/** A product's wiki: its body, its domains (not their contents), fitness, evidence, open questions and problems. */
export function ProductWiki({ index, id }: { index: SpecIndex; id: string }) {
  const product = index.byId.get(id)!;
  const domains = index.domainsOf.get(id) ?? [];
  const questions = recordsIn(index, (r) => r.kind === 'question' && r.product === id);
  const problems = problemsUnder(index, 'product', id);
  return (
    <div className="spec-body">
      <RecordMarkdown index={index} record={product} />
      <Section title="Domains" count={domains.length}>
        {domains.length === 0 && <p className="hint">No domains yet.</p>}
        <div className="cards">
          {domains.map((d) => (
            <article key={d.id} className="card domain-card">
              <Link to={domainPath(id, d.id)} className="card-title">
                <code>{d.id}</code>
                <strong>{d.title}</strong>
              </Link>
              <CoverageBars coverage={index.coverage.get(d.id)} />
              <ProblemBadge problems={problems.filter((p) => index.byId.get(p.record!)?.domain === d.id)} />
            </article>
          ))}
        </div>
      </Section>
      <Section title="Fitness">
        <FitnessPanel index={index} productId={id} />
      </Section>
      <Section title="Evidence">
        <EvidencePanel index={index} productId={id} />
      </Section>
      <Section title="Open questions" count={questions.length}>
        <QuestionList index={index} questions={questions} />
      </Section>
      <Section title="Problems in this product" count={problems.length}>
        <ProblemList index={index} problems={problems} />
      </Section>
    </div>
  );
}

function QuestionList({ index, questions }: { index: SpecIndex; questions: SpecRecord[] }) {
  if (questions.length === 0) return <p className="hint">No open questions.</p>;
  return (
    <LongList
      label="Open questions"
      className="record-list"
      items={questions}
      itemKey={(q) => q.id}
      searchText={recordText}
      render={(q) => (
        <>
          <RecordLink index={index} id={q.id} />
          <small className="meta">
            {q.fields.owner && <>owner {q.fields.owner}</>}
            {(index.outgoing.get(q.id) ?? []).filter((l) => l.relation === 'about').map((l) => (
              <span key={l.target}> · about <RecordLink index={index} id={l.target} showTitle={false} /></span>
            ))}
          </small>
        </>
      )}
    />
  );
}

/** Kinds that get a section only when the domain has some (a product's own extensions). */
const OPTIONAL_KINDS = new Set(['capability']);
/** Kinds that may sit under a capability rather than directly under the domain. */
const UNDER_CAPABILITY_KINDS = new Set(['use_case', 'flow', 'test']);
/** Capabilities read in their `order`, then by ID. */
const byOrder = (a: SpecRecord, b: SpecRecord) => (Number(a.fields.order) || Infinity) - (Number(b.fields.order) || Infinity) || byIdOrder(a, b);

/** The sections of a domain page: its direct children by kind, under the stage they belong to. */
const DOMAIN_STAGES: { title: string; kinds: string[] }[] = [
  { title: 'Define', kinds: ['capability', 'aggregate', 'use_case'] },
  { title: 'Design', kinds: ['flow', 'view', 'endpoint', 'component', 'test'] },
];

/**
 * A domain's wiki: its direct children grouped by kind (Aggregates, Use cases, Flows, Views,
 * Endpoints, Components, Tests, Open questions), each a row with its count of children, which are
 * folded under it; then coverage and problems.
 */
export function DomainWiki({ index, id }: { index: SpecIndex; id: string }) {
  const [query, setQuery] = useState('');
  const domain = index.byId.get(id)!;
  const q = query.trim().toLowerCase();
  const matches = (r: SpecRecord) => !q || recordText(r).toLowerCase().includes(q);
  const problems = problemsUnder(index, 'domain', id);

  const direct = index.children.get(id) ?? [];
  const ofKind = (kind: string) => {
    const records = direct.filter((r) => r.kind === kind);
    return kind === 'capability' ? [...records].sort(byOrder) : records;
  };
  const staged = new Set([...DOMAIN_STAGES.flatMap((s) => s.kinds), 'question']);
  const otherKinds = [...new Set(direct.map((r) => r.kind))].filter((k) => !staged.has(k));
  // Records of the domain that are neither its children nor theirs (deeper, or misplaced).
  // Every descendant of a direct child is reachable by unfolding it (capability, use case, requirement…).
  const shown = new Set<string>();
  const walk = (r: SpecRecord) => {
    if (shown.has(r.id)) return;
    shown.add(r.id);
    for (const c of index.children.get(r.id) ?? []) walk(c);
  };
  direct.forEach(walk);
  const others = recordsIn(index, (r) => r.domain === id && r.id !== id && !shown.has(r.id) && matches(r));
  const questions = ofKind('question');

  // Use cases, flows and tests can sit under capabilities instead of the domain: once the domain has
  // capabilities, an empty section for one of those kinds is noise, not "none yet".
  const hasCapabilities = ofKind('capability').length > 0;
  const kindSection = (kind: string) => {
    const records = ofKind(kind);
    if (records.length === 0 && (OPTIONAL_KINDS.has(kind) || (hasCapabilities && UNDER_CAPABILITY_KINDS.has(kind)))) return null;
    const title = pluralLabel(kindLabel(index, kind));
    const visible = records.filter((r) => matches(r) || (index.children.get(r.id) ?? []).some(matches)).length;
    return (
      <Section key={kind} title={title} count={records.length}>
        {records.length === 0 ? <p className="hint">None yet.</p>
          : visible === 0 ? <p className="hint">Nothing matches.</p>
          : <RecordTree index={index} records={records} label={title} query={query} />}
      </Section>
    );
  };

  return (
    <div className="spec-body">
      <RecordMarkdown index={index} record={domain} />
      <div className="search">
        <label htmlFor="record-search">Filter records</label>
        <input id="record-search" type="search" value={query} placeholder="ID or title" onChange={(e) => setQuery(e.target.value)} />
      </div>
      {DOMAIN_STAGES.map((stage) => (
        <div key={stage.title} className="stage">
          <h2 className="stage-title">{stage.title}</h2>
          {stage.kinds.map(kindSection)}
        </div>
      ))}
      <Section title="Patterns we follow" count={patternsFollowedBy(index, id).length}>
        <DomainPatterns index={index} domainId={id} query={query} />
      </Section>
      {otherKinds.map(kindSection)}
      {others.length > 0 && (
        <Section title="Other records" count={others.length}>
          <RecordTree index={index} records={others} label="Other records" showKind />
        </Section>
      )}
      <Section title="Open questions" count={questions.length}>
        <QuestionList index={index} questions={questions.filter(matches)} />
      </Section>
      <Section title="Coverage">
        <CoverageBars coverage={index.coverage.get(id)} />
        {(index.coverage.get(id)?.gaps.length ?? 0) > 0 && (
          <LongList
            label="Coverage gaps"
            className="record-list gaps"
            items={index.coverage.get(id)!.gaps}
            itemKey={(g) => `${g.id}-${g.missing}`}
            searchText={(g) => idText(index, g.id)}
            render={(g) => (
              <>
                <RecordLink index={index} id={g.id} />
                <small className="meta">{kindLabel(index, g.kind)} with nothing that {g.missing === 'satisfies' ? 'satisfies' : 'proves'} it</small>
              </>
            )}
          />
        )}
      </Section>
      <Section title="Problems in this domain" count={problems.length}>
        <ProblemList index={index} problems={problems} />
      </Section>
    </div>
  );
}

/** The address of Checks filtered to one product, or of every check. */
export const checksFor = (product: string | null) => (product ? `${checksPath}?product=${encodeURIComponent(product)}` : checksPath);

function ChecksPage({ index }: { index: SpecIndex }) {
  const { search } = useLocation();
  const spaces = useSpaces();
  const asked = new URLSearchParams(search).get('product');
  const only = asked && index.byId.get(asked)?.kind === 'product' ? index.byId.get(asked)! : null;
  // The filter offers the current space, or the product already filtered to.
  const offer = only ?? (spaces?.current ? index.byId.get(spaces.current.id) ?? null : null);
  const problems = [...index.workspace.problems]
    .filter((p) => !only || (p.record !== null && index.byId.get(p.record)?.product === only.id))
    .sort(problemOrder);
  const groups = new Map<string, Problem[]>();
  for (const p of problems) groups.set(p.check, [...(groups.get(p.check) ?? []), p]);
  const errors = problems.filter((p) => p.severity === 'error').length;
  return (
    <div className="spec-body">
      <PageHeader eyebrow={only ? `Specs · checks in ${only.title}` : 'Specs · every check'} title="Checks">
        <p className={`checks ${errors ? 'failed' : 'ok'}`}>
          {errors} error{errors === 1 ? '' : 's'} · {problems.length - errors} warning{problems.length - errors === 1 ? '' : 's'}
        </p>
      </PageHeader>
      {offer && (
        <div className="checks-scope" role="group" aria-label="Show checks for">
          <Link to={checksFor(null)} className="scope-option" aria-current={!only ? 'true' : undefined}>All products</Link>
          <Link to={checksFor(offer.id)} className="scope-option" aria-current={only ? 'true' : undefined}>{offer.title}</Link>
        </div>
      )}
      {problems.length === 0 && <p className="hint">{only ? `Every check passed in ${only.title}.` : 'Every check passed.'}</p>}
      {[...groups.entries()].map(([check, group]) => (
        <Section key={check} title={check} count={group.length}>
          <ProblemList index={index} problems={group} showCheck={false} />
        </Section>
      ))}
    </div>
  );
}
