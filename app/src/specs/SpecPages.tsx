import { lazy, Suspense, useState, type ReactNode } from 'react';
import { Link } from '../router';
import { OpenInGraph } from '../graph/route';
import { FormatPage } from './FormatPage';
import { Markdown } from './Markdown';
import { CoverageBars, EvidencePanel, FitnessPanel } from './ProductHealth';
import {
  byIdOrder,
  checksPath,
  domainPath,
  formatPath,
  kindLabel,
  problemOrder,
  productPath,
  recordPath,
  relationLabel,
  type Problem,
  type SpecIndex,
  type SpecLink,
  type SpecRecord,
  type SpecRoute,
  type SpecState,
} from './data';

const DomainGraph = lazy(() => import('./DomainGraph'));

// ---------- Menu ----------

export function SpecMenu({ spec, path }: { spec: SpecState; path: string }) {
  const current = (to: string) => (path === to || path.startsWith(`${to}/`) ? 'page' : undefined);
  const { index } = spec;
  const errors = index?.workspace.problems.filter((p) => p.severity === 'error').length ?? 0;
  const total = index?.workspace.problems.length ?? 0;
  return (
    <>
      <p className="eyebrow">Specs</p>
      {spec.error && !index && <p className="error">{spec.error}</p>}
      {index && (
        <ul>
          {index.products.map((product) => (
            <li key={product.id}>
              <Link to={productPath(product.id)} aria-current={path === productPath(product.id) ? 'page' : undefined}>
                {product.title}
              </Link>
              {(index.domainsOf.get(product.id) ?? []).length > 0 && (
                <ul className="submenu">
                  {index.domainsOf.get(product.id)!.map((domain) => (
                    <li key={domain.id}>
                      <Link to={domainPath(product.id, domain.id)} aria-current={current(domainPath(product.id, domain.id))}>
                        {domain.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
          <li>
            <Link to={checksPath} aria-current={current(checksPath)}>
              Checks <span className={`count ${errors ? 'has-errors' : ''}`}>{total}</span>
            </Link>
          </li>
          <li>
            <Link to={formatPath} aria-current={current(formatPath)}>Record format</Link>
          </li>
        </ul>
      )}
    </>
  );
}

// ---------- Shared pieces ----------

function RecordLink({ index, id, showTitle = true }: { index: SpecIndex; id: string; showTitle?: boolean }) {
  const record = index.byId.get(id);
  if (!record) return <span className="record-link missing" title="No record has this ID"><code>{id}</code></span>;
  return (
    <Link to={recordPath(id)} className="record-link">
      <code>{id}</code>
      {showTitle && <span>{record.title}</span>}
    </Link>
  );
}

function ProblemList({ index, problems, showRecord = true, showCheck = true }: { index: SpecIndex; problems: Problem[]; showRecord?: boolean; showCheck?: boolean }) {
  if (problems.length === 0) return <p className="hint">No problems.</p>;
  return (
    <ul className="problems">
      {[...problems].sort(problemOrder).map((p, i) => (
        <li key={i} className={`problem ${p.severity}`}>
          <span className="severity">{p.severity}</span>
          <span className="problem-text">
            {showRecord && (p.record ? <RecordLink index={index} id={p.record} showTitle={false} /> : <code>workspace</code>)}{' '}
            {p.message}
          </span>
          {showCheck && <code className="check-name">{p.check}</code>}
        </li>
      ))}
    </ul>
  );
}

function Section({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <section className="spec-section">
      <h2>{title}{count !== undefined && <span className="section-count">{count}</span>}</h2>
      {children}
    </section>
  );
}

function PageHeader({ eyebrow, title, id, children }: { eyebrow: ReactNode; title: string; id?: string; children?: ReactNode }) {
  return (
    <header className="spec-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {id && <p className="record-id"><Link to={recordPath(id)} className="record-link"><code>{id}</code></Link></p>}
      </div>
      {children}
    </header>
  );
}

function ProblemBadge({ problems }: { problems: Problem[] }) {
  if (problems.length === 0) return null;
  const errors = problems.filter((p) => p.severity === 'error').length;
  return (
    <span className={`badge ${errors ? 'error' : 'warning'}`} title={problems.map((p) => p.message).join('\n')}>
      {errors ? `${errors} error${errors > 1 ? 's' : ''}` : `${problems.length} warning${problems.length > 1 ? 's' : ''}`}
    </span>
  );
}

function SourceNote({ spec }: { spec: SpecState }) {
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

export function SpecView({ spec, route }: { spec: SpecState; route: SpecRoute }) {
  const { index } = spec;
  let page: ReactNode;
  if (!index) {
    page = <div className="placeholder"><p>{spec.error ? `Couldn't load the specs: ${spec.error}` : 'Loading specs…'}</p></div>;
  } else if (route.page === 'checks') {
    page = <ChecksPage index={index} />;
  } else if (route.page === 'record') {
    page = <RecordPage index={index} id={route.id} />;
  } else if (route.page === 'product') {
    page = <ProductPage index={index} id={route.product} />;
  } else if (route.page === 'domain') {
    page = <DomainPage index={index} productId={route.product} id={route.domain} tab={route.tab} />;
  } else if (route.page === 'format') {
    page = <FormatPage hash={window.location.hash} />;
  } else if (route.page === 'specs') {
    page = <SpecsHome index={index} />;
  } else {
    page = <NotFound what="page" />;
  }
  return (
    <main className="spec-page">
      <SourceNote spec={spec} />
      {spec.error && index && <p className="error">Couldn't reload the specs: {spec.error}</p>}
      {page}
    </main>
  );
}

function NotFound({ what, id }: { what: string; id?: string }) {
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

function ProductPage({ index, id }: { index: SpecIndex; id: string }) {
  const product = index.byId.get(id);
  if (!product || product.kind !== 'product') return <NotFound what="product" id={id} />;
  const domains = index.domainsOf.get(id) ?? [];
  const questions = recordsIn(index, (r) => r.kind === 'question' && r.product === id);
  const problems = index.workspace.problems.filter((p) => p.record && index.byId.get(p.record)?.product === id);
  return (
    <div className="spec-body">
      <PageHeader eyebrow={<>Product · <Link to={recordPath(id)}>{product.path}</Link></>} title={product.title} id={id}>
        <ProblemBadge problems={problems} />
      </PageHeader>
      <Markdown source={product.body} />
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
      <Section title="Problems" count={problems.length}>
        <ProblemList index={index} problems={problems} />
      </Section>
    </div>
  );
}

function QuestionList({ index, questions }: { index: SpecIndex; questions: SpecRecord[] }) {
  if (questions.length === 0) return <p className="hint">No open questions.</p>;
  return (
    <ul className="record-list">
      {questions.map((q) => (
        <li key={q.id}>
          <RecordLink index={index} id={q.id} />
          <small className="meta">
            {q.fields.owner && <>owner {q.fields.owner}</>}
            {(index.outgoing.get(q.id) ?? []).filter((l) => l.relation === 'about').map((l) => (
              <span key={l.target}> · about <RecordLink index={index} id={l.target} showTitle={false} /></span>
            ))}
          </small>
        </li>
      ))}
    </ul>
  );
}

// Fields worth showing in a list row, by kind.
const ROW_FIELDS: Record<string, string[]> = {
  use_case: ['actor'],
  endpoint: ['method', 'route'],
  component: ['component_type', 'file'],
  test: ['test_type', 'run_by'],
};

const DEFINE_GROUPS: { kind: string; nested: string; title: string }[] = [
  { kind: 'aggregate', nested: 'domain_rule', title: 'Aggregates and domain rules' },
  { kind: 'use_case', nested: 'requirement', title: 'Use cases and requirements' },
];
const DESIGN_KINDS: { kind: string; title: string }[] = [
  { kind: 'flow', title: 'Flows' },
  { kind: 'view', title: 'Views' },
  { kind: 'endpoint', title: 'Endpoints' },
  { kind: 'component', title: 'Components' },
  { kind: 'test', title: 'Tests' },
];

function DomainPage({ index, productId, id, tab }: { index: SpecIndex; productId: string; id: string; tab: 'list' | 'graph' }) {
  const [query, setQuery] = useState('');
  const domain = index.byId.get(id);
  if (!domain || domain.kind !== 'domain' || domain.product !== productId) return <NotFound what="domain" id={id} />;
  const product = index.byId.get(productId)!;

  const all = recordsIn(index, (r) => r.domain === id && r.id !== id);
  const q = query.trim().toLowerCase();
  const matches = (r: SpecRecord) => !q || r.id.toLowerCase().includes(q) || r.title.toLowerCase().includes(q);
  const gaps = new Map<string, string[]>();
  for (const g of index.coverage.get(id)?.gaps ?? []) gaps.set(g.id, [...(gaps.get(g.id) ?? []), g.missing]);
  const problems = index.workspace.problems.filter((p) => p.record && index.byId.get(p.record)?.domain === id);

  const placed = new Set<string>();
  const ofKind = (kind: string) => all.filter((r) => r.kind === kind);
  const row = (r: SpecRecord) => (
    <RecordRow key={r.id} index={index} record={r} gaps={gaps.get(r.id) ?? []} />
  );

  const defineGroups = DEFINE_GROUPS.map((g) => {
    const parents = ofKind(g.kind);
    parents.forEach((p) => placed.add(p.id));
    const items = parents
      .map((p) => {
        const nested = (index.children.get(p.id) ?? []).filter((c) => c.kind === g.nested);
        nested.forEach((c) => placed.add(c.id));
        const shown = matches(p) ? nested : nested.filter(matches);
        return { parent: p, nested: shown, visible: matches(p) || shown.length > 0 };
      })
      .filter((i) => i.visible);
    return { ...g, items };
  });
  const designGroups = DESIGN_KINDS.map((g) => {
    const records = ofKind(g.kind);
    records.forEach((r) => placed.add(r.id));
    return { ...g, records: records.filter(matches) };
  });
  const questions = ofKind('question');
  questions.forEach((r) => placed.add(r.id));
  const others = all.filter((r) => !placed.has(r.id) && matches(r));

  const listPath = domainPath(productId, id);
  return (
    <div className={`spec-body ${tab === 'graph' ? 'with-graph' : ''}`}>
      <PageHeader
        eyebrow={<><Link to={productPath(productId)}>{product.title}</Link> · Domain · <Link to={recordPath(id)}>{domain.path}</Link></>}
        title={domain.title}
        id={id}
      >
        <ProblemBadge problems={problems} />
        <OpenInGraph id={id} />
      </PageHeader>
      <nav className="tabs" aria-label="Domain views">
        <Link to={listPath} aria-current={tab === 'list' ? 'page' : undefined}>Records</Link>
        <Link to={`${listPath}/graph`} aria-current={tab === 'graph' ? 'page' : undefined}>Graph</Link>
      </nav>
      {tab === 'graph' ? (
        <Suspense fallback={<p className="hint">Loading the graph…</p>}>
          <DomainGraph index={index} domain={id} />
        </Suspense>
      ) : (
        <>
          <Markdown source={domain.body} />
          <div className="search">
            <label htmlFor="record-search">Filter records</label>
            <input id="record-search" type="search" value={query} placeholder="ID or title" onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="stage">
            <h2 className="stage-title">Define</h2>
            {defineGroups.map((g) => (
              <Section key={g.kind} title={g.title} count={g.items.length}>
                {g.items.length === 0 ? <p className="hint">{q ? 'Nothing matches.' : 'None yet.'}</p> : (
                  <ul className="record-list">
                    {g.items.map(({ parent, nested }) => (
                      <li key={parent.id} className="group">
                        <RecordRowBody index={index} record={parent} gaps={gaps.get(parent.id) ?? []} />
                        {nested.length > 0 && <ul className="record-list nested">{nested.map(row)}</ul>}
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            ))}
          </div>
          <div className="stage">
            <h2 className="stage-title">Design</h2>
            {designGroups.map((g) => (
              <Section key={g.kind} title={g.title} count={g.records.length}>
                {g.records.length === 0 ? <p className="hint">{q ? 'Nothing matches.' : 'None yet.'}</p> : <ul className="record-list">{g.records.map(row)}</ul>}
              </Section>
            ))}
          </div>
          {others.length > 0 && (
            <Section title="Other records" count={others.length}>
              <ul className="record-list">{others.map(row)}</ul>
            </Section>
          )}
          <Section title="Open questions" count={questions.length}>
            <QuestionList index={index} questions={questions.filter(matches)} />
          </Section>
          <Section title="Coverage">
            <CoverageBars coverage={index.coverage.get(id)} />
            {(index.coverage.get(id)?.gaps.length ?? 0) > 0 && (
              <ul className="record-list gaps">
                {index.coverage.get(id)!.gaps.map((g) => (
                  <li key={`${g.id}-${g.missing}`}>
                    <RecordLink index={index} id={g.id} />
                    <small className="meta">{kindLabel(index, g.kind)} with nothing that {g.missing === 'satisfies' ? 'satisfies' : 'proves'} it</small>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="Problems" count={problems.length}>
            <ProblemList index={index} problems={problems} />
          </Section>
        </>
      )}
    </div>
  );
}

function RecordRow(props: { index: SpecIndex; record: SpecRecord; gaps: string[] }) {
  return <li><RecordRowBody {...props} /></li>;
}

function RecordRowBody({ index, record, gaps }: { index: SpecIndex; record: SpecRecord; gaps: string[] }) {
  const fields = (ROW_FIELDS[record.kind] ?? []).map((f) => record.fields[f]).filter(Boolean);
  return (
    <div className="record-row">
      <RecordLink index={index} id={record.id} />
      <span className="row-tags">
        {fields.length > 0 && <small className="meta">{fields.join(' · ')}</small>}
        {gaps.map((g) => <span key={g} className="badge warning">{g === 'satisfies' ? 'not satisfied' : 'not proved'}</span>)}
        <ProblemBadge problems={index.problemsFor.get(record.id) ?? []} />
      </span>
    </div>
  );
}

function groupByRelation(links: SpecLink[]) {
  const groups = new Map<string, SpecLink[]>();
  for (const l of links) groups.set(l.relation, [...(groups.get(l.relation) ?? []), l]);
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function LinkGroups({ index, links, direction }: { index: SpecIndex; links: SpecLink[]; direction: 'out' | 'in' }) {
  if (links.length === 0) return <p className="hint">{direction === 'out' ? 'This record links to nothing.' : 'Nothing links to this record.'}</p>;
  return (
    <dl className="link-groups">
      {groupByRelation(links).map(([relation, group]) => (
        <div key={relation}>
          <dt>{direction === 'out' ? relationLabel(relation) : `${relationLabel(relation)} this`}</dt>
          {[...group].sort((a, b) => (direction === 'out' ? a.target.localeCompare(b.target, 'en', { numeric: true }) : a.source.localeCompare(b.source, 'en', { numeric: true }))).map((l) => (
            <dd key={`${l.source}-${l.target}`}>
              <RecordLink index={index} id={direction === 'out' ? l.target : l.source} />
            </dd>
          ))}
        </div>
      ))}
    </dl>
  );
}

function RecordPage({ index, id }: { index: SpecIndex; id: string }) {
  const record = index.byId.get(id);
  if (!record) return <NotFound what="record" id={id} />;
  const kind = index.kinds.get(record.kind);
  const children = index.children.get(id) ?? [];
  const problems = index.problemsFor.get(id) ?? [];
  const fields = Object.entries(record.fields);
  const product = record.product ? index.byId.get(record.product) : undefined;
  const domain = record.domain ? index.byId.get(record.domain) : undefined;
  return (
    <div className="spec-body">
      <PageHeader
        eyebrow={<>
          {product && record.kind !== 'product' && <><Link to={productPath(product.id)}>{product.title}</Link> · </>}
          {domain && product && record.kind !== 'domain' && <><Link to={domainPath(product.id, domain.id)}>{domain.title}</Link> · </>}
          {kind?.label ?? record.kind}
        </>}
        title={record.title}
        id={id}
      >
        <ProblemBadge problems={problems} />
        <OpenInGraph id={id} />
      </PageHeader>
      <div className="record-layout">
        <div className="record-main">
          <Markdown source={record.body} />
          <Section title="Problems" count={problems.length}>
            <ProblemList index={index} problems={problems} showRecord={false} />
          </Section>
          {record.kind === 'product' && <p><Link to={productPath(id)}>Open the product overview</Link></p>}
          {record.kind === 'domain' && record.product && <p><Link to={domainPath(record.product, id)}>Open the domain overview</Link></p>}
        </div>
        <aside className="record-side">
          <dl className="fields">
            <div><dt>Kind</dt><dd title={kind?.description}>{kind?.label ?? record.kind}</dd></div>
            {fields.map(([name, value]) => (
              <div key={name}><dt>{name.replaceAll('_', ' ')}</dt><dd>{value}</dd></div>
            ))}
            <div><dt>Spec file</dt><dd><code>{record.path}</code></dd></div>
          </dl>
          <h3>Parent</h3>
          {record.parent ? <RecordLink index={index} id={record.parent} /> : <p className="hint">None (top level).</p>}
          <h3>Children <span className="section-count">{children.length}</span></h3>
          {children.length === 0 ? <p className="hint">None.</p> : (
            <ul className="plain">
              {children.map((c) => <li key={c.id}><RecordLink index={index} id={c.id} /> <small className="meta">{kindLabel(index, c.kind)}</small></li>)}
            </ul>
          )}
          <h3>Links out</h3>
          <LinkGroups index={index} links={index.outgoing.get(id) ?? []} direction="out" />
          <h3>Links in</h3>
          <LinkGroups index={index} links={index.incoming.get(id) ?? []} direction="in" />
        </aside>
      </div>
    </div>
  );
}

function ChecksPage({ index }: { index: SpecIndex }) {
  const problems = [...index.workspace.problems].sort(problemOrder);
  const groups = new Map<string, Problem[]>();
  for (const p of problems) groups.set(p.check, [...(groups.get(p.check) ?? []), p]);
  const errors = problems.filter((p) => p.severity === 'error').length;
  return (
    <div className="spec-body">
      <PageHeader eyebrow="Specs · every check" title="Checks">
        <p className={`checks ${errors ? 'failed' : 'ok'}`}>
          {errors} error{errors === 1 ? '' : 's'} · {problems.length - errors} warning{problems.length - errors === 1 ? '' : 's'}
        </p>
      </PageHeader>
      {problems.length === 0 && <p className="hint">Every check passed.</p>}
      {[...groups.entries()].map(([check, group]) => (
        <Section key={check} title={check} count={group.length}>
          <ProblemList index={index} problems={group} showCheck={false} />
        </Section>
      ))}
    </div>
  );
}
