// The product's page at its ID, /<product-id> (LA-V51), and its space's Checks page at /<product-id>/checks (LA-V41).
import { useState, type ReactNode } from 'react';
import { Link } from '../router';
import { checkPagePath } from '../format/reference';
import { RecordText } from './RecordText';
import { Prose } from './mentions';
import { DomainPatterns } from './PatternParts';
import { patternsFollowedBy } from './patterns';
import { CoverageBars, ProductSummary } from './ProductHealth';
import { LongList } from '../components/LongList';
import { countOf } from '../plural';
import { PageHeader, ProblemBadge, ProblemList, RecordLink, RecordTree, Section, StageMark, gapText, idText, levelBelow, recordText, type SectionLevel } from './parts';
import { allFolders, domainFolders, foldedChildren, productFolders, type Folder, type OwnerFolders } from './folders';
import {
  byIdOrder,
  kindLabel,
  isWorkspaceProblem,
  problemOrder,
  textOf,
  type Problem,
  type RecordedException,
  type SpecIndex,
  type SpecRecord,
  type SpecRoute,
  type SpecState,
} from './data';
import { addressOf, HOME_PATH } from '../views/address';

// The spec pages that are not about one record: the products and the checks (the record format's
// pages are in app/src/format);
// and the wiki content of a product and a domain, which the focus page (app/src/views) shows in
// its Wiki pane beside or instead of the graph.

// ---------- Shared pieces ----------

const recordsIn = (index: SpecIndex, predicate: (r: SpecRecord) => boolean) => index.workspace.records.filter(predicate).sort(byIdOrder);

// ---------- Pages ----------

/**
 * The pages without a focus record: the products (the space chooser, outside every space), a
 * space's Checks, and unknown addresses. `space` is the current space's index.
 */
export function SpecView({ spec, space, route }: { spec: SpecState; space: SpecIndex | null; route: SpecRoute }) {
  const { index } = spec;
  let page: ReactNode;
  if (!index || !space) {
    page = <div className="placeholder"><p>{spec.error ? `Couldn't load the specs: ${spec.error}` : 'Loading specs…'}</p></div>;
  } else if (route.page === 'checks') {
    const product = space.byId.get(route.product);
    page = product?.kind === 'product' ? <ChecksPage index={space} product={product} /> : <NotFound what="product" id={route.product} />;
  } else if (route.page === 'specs') {
    page = <SpecsHome index={index} />;
  } else {
    page = <NotFound what="page" />;
  }
  return (
    <main className="spec-page panel" id="main">
      {spec.error && index && <p className="error">Couldn't reload the specs: {spec.error}</p>}
      {page}
    </main>
  );
}

export function NotFound({ what, id }: { what: string; id?: string }) {
  return (
    <div className="placeholder">
      <p>{id ? <>There's no {what} with the ID <code>{id}</code>.</> : `There's no such ${what}.`} <Link to={HOME_PATH}>See all products</Link>.</p>
    </div>
  );
}

function SpecsHome({ index }: { index: SpecIndex }) {
  return (
    <div className="spec-body">
      <PageHeader eyebrow="Specs" title="Products" />
      {index.products.length === 0 && <p className="hint">No products yet. Run <code>lathe init</code> to add the first to <code>data/product.jsonl</code>.</p>}
      <div className="cards">
        {index.products.map((p) => (
          <Link key={p.id} to={addressOf(p.id)} className="card">
            <code>{p.id}</code>
            <strong>{p.title}</strong>
            <small>{countOf((index.domainsOf.get(p.id) ?? []).length, 'domain')}</small>
          </Link>
        ))}
      </div>
    </div>
  );
}

/** The problems in a product's or a domain's records. */
export const problemsUnder = (index: SpecIndex, key: 'product' | 'domain', id: string) =>
  index.workspace.problems.filter((p) => p.record && index.byId.get(p.record)?.[key] === id);

/**
 * A product's business outcomes, the discovery stage (LA-V51): each with its measurable statement, its measure and
 * target, and the capabilities that serve it. An outcome no capability serves says so, as coverage reports it.
 */
function BusinessOutcomes({ index, productId }: { index: SpecIndex; productId: string }) {
  const outcomes = recordsIn(index, (r) => r.kind === 'business_outcome' && r.parent === productId);
  return (
    <Section title="Business outcomes" count={outcomes.length} className="stage stage-discovery product-outcomes">
      <p className="hint">What the product exists to achieve, each measurable, and the capabilities that serve it.</p>
      {outcomes.length === 0 && <p className="hint">No business outcomes yet.</p>}
      <ul className="outcome-list">
        {outcomes.map((o) => {
          const servedBy = (index.incoming.get(o.id) ?? []).filter((l) => l.relation === 'serves').map((l) => l.source).sort();
          return (
            <li key={o.id} className="outcome">
              <RecordLink index={index} id={o.id} row />
              <div className="outcome-statement"><Prose index={index} source={textOf(o.row, 'statement')} self={o.id} /></div>
              <dl className="fields">
                <div><dt>Measure</dt><dd><Prose index={index} source={textOf(o.row, 'measure')} self={o.id} /></dd></div>
                <div><dt>Target</dt><dd><Prose index={index} source={textOf(o.row, 'target')} self={o.id} /></dd></div>
                <div>
                  <dt>Served by</dt>
                  <dd>
                    {servedBy.length === 0 ? <span className="hint">No capability yet.</span> : (
                      <ul className="plain served-by">{servedBy.map((c) => <li key={c}><RecordLink index={index} id={c} /></li>)}</ul>
                    )}
                  </dd>
                </div>
              </dl>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

/**
 * A product's wiki: its text, its business outcomes, its domains (not their contents), what it shares in its stages
 * (patterns, standards, and the value objects, views, integrations and UI components two or more
 * domains use, or none), its summary, open questions and problems.
 */
export function ProductWiki({ index, id }: { index: SpecIndex; id: string }) {
  const product = index.byId.get(id)!;
  const domains = index.domainsOf.get(id) ?? [];
  const questions = recordsIn(index, (r) => r.kind === 'question' && r.product === id);
  const problems = problemsUnder(index, 'product', id);
  // Its business outcomes have a section of their own, so Shared holds the other stages.
  const own = productFolders(index, id);
  const shared = own.stages.filter((s) => s.stage !== 'discovery' && s.count > 0);
  const ownCount = shared.reduce((n, s) => n + s.count, 0);
  return (
    <div className="spec-body">
      <RecordText index={index} record={product} />
      <BusinessOutcomes index={index} productId={id} />
      <Section title="Domains" count={domains.length}>
        {domains.length === 0 && <p className="hint">No domains yet.</p>}
        <div className="cards">
          {domains.map((d) => (
            <article key={d.id} className="card domain-card">
              <Link to={addressOf(d.id)} className="card-title">
                <code>{d.id}</code>
                <strong>{d.title}</strong>
              </Link>
              <CoverageBars coverage={index.coverage.get(d.id)} />
              <ProblemBadge problems={problems.filter((p) => index.byId.get(p.record!)?.domain === d.id)} />
            </article>
          ))}
        </div>
      </Section>
      {ownCount > 0 && (
        <Section title="Shared" count={ownCount} className="product-shared">
          <p className="hint">Patterns and standards, and the records with no owner that two or more domains use, or none, with what sits under them.</p>
          <StageSections index={index} folders={{ stages: shared, loose: [] }} query="" level={3} />
          {index.coverage.get(id) && (
            <Section level={3} title="Shared coverage" className="product-coverage">
              <CoverageBars coverage={index.coverage.get(id)} />
            </Section>
          )}
        </Section>
      )}
      <Section title="Summary">
        <ProductSummary index={index} productId={id} />
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
          <RecordLink index={index} id={q.id} row />
          <small className="meta">
            {textOf(q.row, 'owner') && <>owner {textOf(q.row, 'owner')}</>}
            {(index.outgoing.get(q.id) ?? []).filter((l) => l.relation === 'about').map((l) => (
              <span key={l.target}> · about <RecordLink index={index} id={l.target} showTitle={false} /></span>
            ))}
          </small>
        </>
      )}
    />
  );
}

/**
 * A domain's or a product's records in its stages, as the side nav reads them: each stage under its
 * heading and color (Domain model, Use cases, Interaction design, Technical specification, Test plan),
 * and in it one section per kind with records (or, for a stage with one folder, its records directly), each record a
 * row whose children of the same stage fold under it. A stage with nothing yet says so. Then the folders outside the stages, except open
 * questions, which the page lists itself.
 */
function StageSections({ index, folders, query, level = 2 }: { index: SpecIndex; folders: OwnerFolders; query: string; level?: 2 | 3 }) {
  const StageHeading = level === 2 ? 'h2' : 'h3';
  const q = query.trim().toLowerCase();
  const matches = (r: SpecRecord) => !q || recordText(r).toLowerCase().includes(q);
  const nested = (r: SpecRecord) => foldedChildren(index, r);
  const tree = (records: SpecRecord[], label: string) => {
    // A row shows when it, or anything folded under it at any depth, matches.
    const deep = (r: SpecRecord): boolean => matches(r) || nested(r).some(deep);
    const visible = records.filter(deep).length;
    return visible === 0 ? <p className="hint">Nothing matches.</p> : <RecordTree index={index} records={records} label={label} query={query} nested={nested} />;
  };
  const folderSection = (folder: Folder, at: SectionLevel) => (
    <Section key={folder.key} level={at} title={folder.label} count={folder.count} className="folder">
      {tree(folder.records, folder.label)}
    </Section>
  );
  return (
    <>
      {folders.stages.map((stage) => (
        <div key={stage.key} className={`stage stage-${stage.stage}`}>
          <StageHeading className="stage-title"><StageMark stage={stage.stage} />{stage.label}<span className="section-count">{stage.count}</span></StageHeading>
          {stage.count === 0 ? <p className="hint">Nothing yet.</p>
            : stage.direct ? tree(stage.direct.records, stage.direct.label)
            : stage.folders.filter((f) => f.count > 0).map((f) => folderSection(f, levelBelow(level)))}
        </div>
      ))}
      {folders.loose.filter((f) => f.kind !== 'question').map((f) => folderSection(f, level))}
    </>
  );
}

/**
 * A domain's wiki, read in the same stages and folders as the side nav (StageSections), then the
 * patterns the domain follows, its open questions, coverage and problems.
 */
export function DomainWiki({ index, id }: { index: SpecIndex; id: string }) {
  const [query, setQuery] = useState('');
  const domain = index.byId.get(id)!;
  const q = query.trim().toLowerCase();
  const matches = (r: SpecRecord) => !q || recordText(r).toLowerCase().includes(q);
  const problems = problemsUnder(index, 'domain', id);

  const folders = domainFolders(index, id);
  // Records of the domain that no folder lists and that no listed record folds (misplaced).
  const shown = new Set<string>();
  const walk = (r: SpecRecord) => {
    if (shown.has(r.id)) return;
    shown.add(r.id);
    for (const c of foldedChildren(index, r)) walk(c);
  };
  allFolders(folders).forEach((f) => f.records.forEach(walk));
  const others = recordsIn(index, (r) => r.domain === id && r.id !== id && !shown.has(r.id) && matches(r));
  const questions = folders.loose.find((f) => f.kind === 'question')?.records ?? [];

  return (
    <div className="spec-body">
      <RecordText index={index} record={domain} />
      <div className="search">
        <label htmlFor="record-search">Filter records</label>
        <input id="record-search" type="search" value={query} placeholder="ID or title" onChange={(e) => setQuery(e.target.value)} />
      </div>
      <StageSections index={index} folders={folders} query={query} />
      <Section title="Patterns we follow" count={patternsFollowedBy(index, id).length}>
        <DomainPatterns index={index} domainId={id} query={query} />
      </Section>
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
                <RecordLink index={index} id={g.id} row />
                <small className="meta" title={g.message}>{kindLabel(index, g.kind)} {gapText(g.missing)}</small>
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

/** Problems by check, in the order of their first problem (errors first). */
function byCheck(problems: Problem[]): [string, Problem[]][] {
  const groups = new Map<string, Problem[]>();
  for (const p of [...problems].sort(problemOrder)) groups.set(p.check, [...(groups.get(p.check) ?? []), p]);
  return [...groups.entries()];
}

/**
 * A space's Checks page: its product's problems by check, then the problems that belong to no
 * product (a broken meta-model or config), which every space's Checks page shows under Workspace.
 * It reads the space's own index, so no other product's problems are in it.
 */
function ChecksPage({ index, product }: { index: SpecIndex; product: SpecRecord }) {
  const all = index.workspace.problems;
  const workspace = all.filter((p) => isWorkspaceProblem(index, p));
  const own = all.filter((p) => !isWorkspaceProblem(index, p));
  const errors = all.filter((p) => p.severity === 'error').length;
  return (
    <div className="spec-body">
      <PageHeader eyebrow={`${product.title} · checks`} title="Checks">
        <p className={`checks ${errors ? 'failed' : 'ok'}`}>
          {errors} error{errors === 1 ? '' : 's'} · {all.length - errors} warning{all.length - errors === 1 ? '' : 's'}
        </p>
      </PageHeader>
      {all.length === 0 && <p className="hint">Every check passed in {product.title}.</p>}
      {byCheck(own).map(([check, group]) => (
        <Section key={check} title={check} titleTo={checkPagePath(check)} count={group.length}>
          <ProblemList index={index} problems={group} showCheck={false} />
        </Section>
      ))}
      {workspace.length > 0 && (
        <Section title="Workspace" count={workspace.length}>
          <p className="hint">Problems that belong to no product, such as in the meta-model or the config. Every space shows them.</p>
          {byCheck(workspace).map(([check, group]) => (
            <Section key={check} level={3} title={check} titleTo={checkPagePath(check)} count={group.length}>
              <ProblemList index={index} problems={group} showCheck={false} />
            </Section>
          ))}
        </Section>
      )}
      {index.workspace.exceptions.length > 0 && <RecordedExceptions index={index} exceptions={index.workspace.exceptions} />}
    </div>
  );
}

/**
 * The recorded exceptions (LA-V41-R04): each command that also changes another aggregate of its
 * domain in the same transaction, with the aggregate and the reason. They are deliberate deviations,
 * not problems: listed in a section of their own, never counted or marked as warnings.
 */
function RecordedExceptions({ index, exceptions }: { index: SpecIndex; exceptions: RecordedException[] }) {
  const items = exceptions.map((e) => ({ e, key: `${e.command} ${e.aggregate}` }));
  return (
    <Section title="Recorded exceptions" count={exceptions.length}>
      <p className="hint">Deliberate deviations, each recorded with its reason: a command that also changes another aggregate in the same transaction. They are not problems.</p>
      <LongList
        label="Recorded exceptions"
        className="record-list exceptions"
        items={items}
        itemKey={(item) => item.key}
        searchText={({ e }) => `${idText(index, e.command)} ${idText(index, e.aggregate)} ${e.reason}`}
        render={({ e }) => (
          <>
            <RecordLink index={index} id={e.command} showTitle={false} row />
            <span className="exception-text">also changes <RecordLink index={index} id={e.aggregate} showTitle={false} /> in the same transaction: {e.reason}</span>
          </>
        )}
      />
    </Section>
  );
}
