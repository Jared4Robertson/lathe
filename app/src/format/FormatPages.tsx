import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Button } from '../components/Button';
import { Icon } from '../components/icons';
import { LongList } from '../components/LongList';
import { ResizeHandle } from '../components/ResizeHandle';
import { lowerLabel, plural } from '../plural';
import { Link, useLocation } from '../router';
import { BottomSheet } from '../shell/BottomSheet';
import { useAnnounce, useCommand } from '../shell/commands';
import { isBool, usePanelSize, usePref } from '../shell/prefs';
import { useSpaces } from '../shell/spaces';
import { Tooltip } from '../shell/Tooltip';
import { useNarrow } from '../shell/useNarrow';
import { addressOf } from '../views/address';
import { treeGroup } from '../graph/tree';
import { byIdOrder, type Problem, type SpecIndex, type SpecRecord, type SpecState, type Stage } from '../specs/data';
import { Markdown } from '../specs/Markdown';
import { PageHeader, ProblemList, RecordLink, Section } from '../specs/parts';
import {
  FIELDS_ANCHOR,
  ID_SCOPE_TEXT,
  ORIGIN_TEXT,
  checkPagePath,
  checksOf,
  columnType,
  fieldAnchor,
  findCheck,
  findKind,
  formatPath,
  kindPagePath,
  obligationShort,
  obligationText,
  relationWords,
  relationsOf,
  stageName,
  useFormat,
  type CheckReference,
  type FormatReference,
  type KindReference,
  type RelationReference,
} from './reference';
import './format.css';

// The format reference's pages (LA-AUT-UC14): /format (the concepts, then an index of the kinds by
// stage, the relations, and the checks by severity), /format/kinds/<kind> and
// /format/checks/<check>. Each opens in the workbench as a record does: one pane with the page's
// title in it, and the side bar beside it showing the kind's or the check's facts (a bottom sheet
// on a phone). The pages read the schema and the check rows served with the data, so a product's
// own kinds and checks show.

export type FormatRoute = { page: 'format' } | { page: 'format-kind'; kind: string } | { page: 'format-check'; check: string };
export const isFormatRoute = (r: { page: string } | null): r is FormatRoute => !!r && ['format', 'format-kind', 'format-check'].includes(r.page);

// The side bar's open state and width are the workbench's, shared with record pages.
const SIDE_BAR_KEY = 'lathe:side-bar-open';
const SIDE_BAR_WIDTH_KEY = 'lathe:side-bar-width';

export function FormatPages({ spec, route }: { spec: SpecState; route: FormatRoute }) {
  const { index } = spec;
  const reference = useFormat(index);
  let body: ReactNode;
  if (!index || !reference) {
    body = <div className="placeholder"><p>{spec.error ? `Couldn't load the specs: ${spec.error}` : 'Loading the format…'}</p></div>;
  } else {
    body = <Workbench index={index} reference={reference} route={route} />;
  }
  return (
    <main className="focus-page format-page" id="main">
      {spec.error && index && <p className="error">Couldn't reload the specs: {spec.error}</p>}
      {body}
    </main>
  );
}

interface PageProps {
  index: SpecIndex;
  reference: FormatReference;
}

/** One pane holding the page, and the side bar: the workbench as a record page lays it out. */
function Workbench({ index, reference, route }: PageProps & { route: FormatRoute }) {
  const narrow = useNarrow();
  const announce = useAnnounce();
  const [open, setOpen] = usePref<boolean>(SIDE_BAR_KEY, true, isBool);
  const [width, setWidth, resetWidth] = usePanelSize(SIDE_BAR_WIDTH_KEY, 340, 260, 640);
  const [sheet, setSheet] = useState(false);
  const layout = useRef<HTMLDivElement>(null);
  const sideBarEl = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const { path } = useLocation();
  const showing = narrow ? sheet : open;
  const setShowing = useCallback((show: boolean) => {
    if (narrow) setSheet(show); else setOpen(show);
    announce(show ? 'Side bar shown' : 'Side bar hidden');
    if (!show) setTimeout(() => toggle.current?.focus(), 0);
  }, [narrow, setOpen, announce]);
  useEffect(() => { setSheet(false); }, [path, narrow]);
  useEffect(() => { if (narrow && sheet) sideBarEl.current?.focus(); }, [narrow, sheet]);
  useCommand('toggleSideBar', () => setShowing(!showing));
  useCommand('focusSideBar', () => {
    if (!showing) setShowing(true);
    setTimeout(() => sideBarEl.current?.focus(), 0);
  });

  // A new page starts at the top, or at the part its address names (#fields, #7-what-records-do-not-carry).
  useEffect(() => {
    const scrollToHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      const target = id ? document.getElementById(id) : null;
      if (target) target.scrollIntoView?.({ block: 'start' });
      else if (scroller.current) scroller.current.scrollTop = 0;
    };
    scrollToHash();
    window.addEventListener('hashchange', scrollToHash);
    return () => window.removeEventListener('hashchange', scrollToHash);
  }, [path]);

  const page = pageFor({ index, reference }, route);
  const sideBarLabel = `${showing ? 'Hide' : 'Show'} the side bar`;
  const facts = (
    <aside ref={sideBarEl} id="side-bar" className="side bar record-side" aria-label="Side bar" tabIndex={-1}>
      <div className="side-bar-head">
        <h2 className="side-bar-title">Side bar</h2>
        <Tooltip label="Hide the side bar" command="toggleSideBar" placement="left">
          <Button variant="icon" label="Hide the side bar" onClick={() => setShowing(false)}>
            <Icon name={narrow ? 'x' : 'sidebar-right'} />
          </Button>
        </Tooltip>
      </div>
      {page.facts}
    </aside>
  );

  const pane = (
    <section className="pane panel pane-wiki" data-view="wiki" aria-label="Reference pane">
      <div className="pane-bar">
        <div className="pane-head">
          <span className="pane-name"><Icon name="format" size={15} /> Reference</span>
        </div>
        <div className="pane-actions">
          <Tooltip label={sideBarLabel} command="toggleSideBar" placement="left">
            <Button
              variant="icon"
              ref={toggle}
              className={`side-bar-toggle${showing ? ' is-on' : ''}`}
              label={sideBarLabel}
              aria-expanded={showing}
              aria-controls="side-bar"
              onClick={() => setShowing(!showing)}
            >
              <Icon name={narrow ? 'info' : 'sidebar-right'} size={16} />
            </Button>
          </Tooltip>
        </div>
      </div>
      <div className="pane-scroll" ref={scroller}>
        <div className="pane-title">{page.title}</div>
        <div className="spec-body">{page.body}</div>
      </div>
    </section>
  );

  if (narrow) {
    return (
      <div className="focus-layout is-phone">
        {pane}
        {sheet && <BottomSheet label="Side bar" className="side-bar-sheet" onClose={() => setShowing(false)}>{facts}</BottomSheet>}
      </div>
    );
  }
  return (
    <div ref={layout} className={`focus-layout${showing ? ' with-side-bar' : ''}`} style={{ '--side-bar-width': `${width}px` } as CSSProperties}>
      <div className="focus-main">{pane}</div>
      {showing && (
        <>
          <ResizeHandle
            label="Resize the side bar"
            side="after"
            value={width}
            min={260}
            max={640}
            step={16}
            bigStep={64}
            valueAt={(x) => (layout.current?.getBoundingClientRect().right ?? x) - x}
            onChange={setWidth}
            onReset={resetWidth}
            collapseBelow={160}
            onCollapse={() => setShowing(false)}
          />
          <div className="side-bar-column panel">{facts}</div>
        </>
      )}
    </div>
  );
}

interface Page {
  title: ReactNode;
  body: ReactNode;
  facts: ReactNode;
}

function pageFor(props: PageProps, route: FormatRoute): Page {
  if (route.page === 'format-kind') {
    const kind = findKind(props.reference, route.kind);
    return kind ? kindPage(props, kind) : missingPage('kind', route.kind);
  }
  if (route.page === 'format-check') {
    const check = findCheck(props.reference, route.check);
    const problems = props.index.workspace.problems.filter((p) => p.check === route.check);
    return check ? checkPage(props, check, problems) : missingPage('check', route.check);
  }
  return homePage(props);
}

function missingPage(what: 'kind' | 'check', name: string): Page {
  return {
    title: <PageHeader eyebrow={<><Link to={formatPath}>Record format</Link> · {what === 'kind' ? 'Kind' : 'Check'}</>} title={name} />,
    body: <div className="placeholder"><p>The format has no {what} called <code>{name}</code>. <Link to={formatPath}>See every kind and check</Link>.</p></div>,
    facts: <p className="hint">Nothing to show.</p>,
  };
}

// ---------- Shared pieces ----------

/** A kind as a clickable row: its name and label, leading to its page (LA-PAT-APP-UX "a row is one link"). */
function KindRows({ reference, kinds, label, meta }: { reference: FormatReference; kinds: readonly string[]; label: string; meta?: (k: KindReference) => ReactNode }) {
  if (kinds.length === 0) return <p className="hint">None.</p>;
  return (
    <LongList
      label={label}
      className="record-list kind-rows"
      items={kinds}
      itemKey={(k) => k}
      searchText={(k) => `${k} ${findKind(reference, k)?.label ?? ''}`}
      render={(k) => {
        const kind = findKind(reference, k);
        return (
          <>
            <KindLink reference={reference} kind={k} row />
            {kind && meta?.(kind)}
          </>
        );
      }}
    />
  );
}

/** A link to a kind's page, by its label and name; "any kind" for '*'. */
function KindLink({ reference, kind, row = false }: { reference: FormatReference; kind: string; row?: boolean }) {
  if (kind === '*') return <span className="any-kind">any kind</span>;
  const label = findKind(reference, kind)?.label;
  return (
    <Link to={kindPagePath(kind)} className={row ? 'record-link row-link' : 'record-link'}>
      <code>{kind}</code>
      {label && <span>{label}</span>}
    </Link>
  );
}

/** A check as a clickable row: its name and summary, with how many problems it reports now. */
function CheckRows({ index, checks, label }: { index: SpecIndex; checks: readonly CheckReference[]; label: string }) {
  if (checks.length === 0) return <p className="hint">None.</p>;
  const counts = new Map<string, number>();
  for (const p of index.workspace.problems) counts.set(p.check, (counts.get(p.check) ?? 0) + 1);
  return (
    <LongList
      label={label}
      className="record-list check-rows"
      items={checks}
      itemKey={(c) => c.check}
      searchText={(c) => `${c.check} ${c.summary}`}
      render={(c) => (
        <>
          <Link to={checkPagePath(c.check)} className="record-link row-link">
            <code>{c.check}</code>
            {c.summary && <span>{c.summary}</span>}
          </Link>
          <span className="row-tags">
            <SeverityTags check={c} />
            {(counts.get(c.check) ?? 0) > 0 && <span className={`badge ${c.severity}`}>{counts.get(c.check)} now</span>}
          </span>
        </>
      )}
    />
  );
}

function SeverityTags({ check }: { check: CheckReference }) {
  return <>{check.severities.map((s) => <span key={s} className={`severity-tag ${s}`}>{s}</span>)}</>;
}

function RelationRows({ reference, relations, from, label }: { reference: FormatReference; relations: readonly RelationReference[]; from: 'source' | 'target'; label: string }) {
  if (relations.length === 0) return <p className="hint">None.</p>;
  return (
    <LongList
      label={label}
      className="record-list relation-rows"
      items={relations}
      itemKey={(r) => `${r.relation}:${r.source_kind}:${r.target_kind}`}
      searchText={(r) => `${r.relation} ${relationWords(r, from)} ${from === 'source' ? r.target_kind : r.source_kind}`}
      render={(r) => (
        <>
          <span className="relation-head">
            <strong>{relationWords(r, from)}</strong> <KindLink reference={reference} kind={from === 'source' ? r.target_kind : r.source_kind} />
          </span>
          <small className="meta">
            <code>{r.relation}</code>
            {r.role && <> · {r.role === 'design' ? 'designs its target' : 'proves its target'}</>}
            {r.description && <> · {r.description}</>}
          </small>
        </>
      )}
    />
  );
}

// ---------- /format ----------

function homePage({ index, reference }: PageProps): Page {
  const errors = reference.checks.filter((c) => c.severity === 'error');
  const warnings = reference.checks.filter((c) => c.severity === 'warning');
  return {
    title: <PageHeader eyebrow="Reference · read from the schema" title="Record format" />,
    body: (
      <>
        <Section title="How records are kept">
          <p>Each kind of record is a table with typed columns. A record's parent is a column that names it, each relation is a table of links, and the database refuses data that breaks a key, a type or a rule. Every table's rows are one file in <code>{index.workspace.dataDir}/</code>, a row to a line, so git keeps their history.</p>
        </Section>
        <section className="spec-section" id="kinds" aria-labelledby="kinds-heading">
          <header className="spec-section-head"><h2 id="kinds-heading">Kinds<span className="section-count">{reference.kinds.length}</span></h2></header>
          <KindIndex reference={reference} />
        </section>
        <section className="spec-section" id="relations" aria-labelledby="relations-heading">
          <header className="spec-section-head"><h2 id="relations-heading">Relations<span className="section-count">{reference.relations.length}</span></h2></header>
          <AllRelations reference={reference} />
        </section>
        <section className="spec-section" id="checks" aria-labelledby="checks-heading">
          <header className="spec-section-head"><h2 id="checks-heading">Checks<span className="section-count">{reference.checks.length}</span></h2></header>
          <Section level={3} title="Errors" count={errors.length}><CheckRows index={index} checks={errors} label="Error checks" /></Section>
          <Section level={3} title="Warnings" count={warnings.length}><CheckRows index={index} checks={warnings} label="Warning checks" /></Section>
        </section>
      </>
    ),
    facts: (
      <>
        <div className="side-bar-identity">
          <p className="eyebrow">Reference</p>
          <p className="side-bar-name">Record format</p>
        </div>
        <dl className="fields">
          <div><dt>Kinds</dt><dd>{reference.kinds.length}</dd></div>
          <div><dt>Relations</dt><dd>{reference.relations.length}</dd></div>
          <div><dt>Stages</dt><dd>{reference.stages.length}</dd></div>
          <div><dt>Checks</dt><dd>{reference.checks.length} ({errors.length} error, {warnings.length} warning)</dd></div>
          <div><dt>From</dt><dd>The schema, with this product's own kinds, and the check table</dd></div>
        </dl>
        <h3>On this page</h3>
        <ul className="plain">
          <li><a href="#kinds">Kinds</a></li>
          <li><a href="#relations">Relations</a></li>
          <li><a href="#checks">Checks</a></li>
        </ul>
      </>
    ),
  };
}

/** The kinds by stage, in the stages' order and each stage's kind order; the kinds outside the stages last. */
function KindIndex({ reference }: { reference: FormatReference }) {
  const groups: { stage: Stage | null; title: string; description: string }[] = [
    ...reference.stages.map((s) => ({ stage: s.stage, title: s.label, description: s.description })),
    { stage: null, title: stageName(reference, null), description: 'The product, which holds everything else, and open questions.' },
  ];
  return (
    <>
      {groups.map((g) => {
        const kinds = reference.kinds.filter((k) => k.stage === g.stage);
        if (kinds.length === 0) return null;
        return (
          <Section key={g.stage ?? 'none'} level={3} title={g.title} count={kinds.length} className={g.stage ? `stage-${g.stage}` : undefined}>
            <p className="hint">{g.description}</p>
            <KindRows reference={reference} kinds={kinds.map((k) => k.kind)} label={`Kinds in ${g.title}`} meta={kindMeta} />
          </Section>
        );
      })}
    </>
  );
}

const kindMeta = (k: KindReference) => (k.obligation ? <small className="meta">obligation: {lowerLabel(obligationShort(true))}</small> : null);

function AllRelations({ reference }: { reference: FormatReference }) {
  if (reference.relations.length === 0) return <p className="hint">None.</p>;
  return (
    <LongList
      label="Relations"
      className="record-list relation-rows"
      items={reference.relations}
      itemKey={(r) => `${r.relation}:${r.source_kind}:${r.target_kind}`}
      searchText={(r) => `${r.relation} ${r.source_kind} ${r.target_kind} ${r.forward_label} ${r.reverse_label}`}
      render={(r) => (
        <>
          <span className="relation-head">
            <KindLink reference={reference} kind={r.source_kind} /> <strong>{relationWords(r, 'source')}</strong> <KindLink reference={reference} kind={r.target_kind} />
          </span>
          <small className="meta">
            <code>{r.relation}</code> · read back: {relationWords(r, 'target')}
            {r.role && <> · {r.role === 'design' ? 'designs its target' : 'proves its target'}</>}
            {r.description && <> · {r.description}</>}
          </small>
        </>
      )}
    />
  );
}

// ---------- /format/kinds/<kind> ----------

/** A record's row as its data file holds it: one JSON object on one line. */
export const rowLineOf = (record: SpecRecord) => JSON.stringify(record.row);

function kindPage({ index, reference }: PageProps, kind: KindReference): Page {
  const relations = relationsOf(reference, kind.kind);
  const checks = checksOf(reference, kind.kind);
  const where = stageName(reference, kind.stage);
  const required = kind.columns.filter((c) => c.required);
  return {
    title: <PageHeader eyebrow={<><Link to={formatPath}>Record format</Link> · Kind · {where}</>} title={kind.label} />,
    body: <KindBody index={index} reference={reference} kind={kind} />,
    facts: (
      <>
        <div className="side-bar-identity">
          <p className="eyebrow">Kind</p>
          <p className="side-bar-name">{kind.label}</p>
          <p className="record-id"><code>{kind.kind}</code></p>
        </div>
        <dl className="fields">
          <div><dt>Stage</dt><dd>{stageName(reference, kind.stage)}</dd></div>
          <div><dt>Obligation</dt><dd>{obligationShort(kind.obligation)}</dd></div>
          <div><dt>ID</dt><dd>{kind.id ? <code>{kind.id.pattern}</code> : 'No convention given'}</dd></div>
          <div><dt>Required</dt><dd>{required.map((c, i) => <span key={c.name}>{i > 0 && ', '}<a href={`#${fieldAnchor(c.name)}`}>{c.name}</a></span>)}</dd></div>
          <div><dt>Records</dt><dd>{index.workspace.records.filter((r) => r.kind === kind.kind).length}</dd></div>
          <div><dt>Links</dt><dd>{relations.out.length} out, {relations.in.length} in</dd></div>
          <div><dt>Checks</dt><dd>{checks.length}</dd></div>
        </dl>
        <h3>Parents <span className="section-count">{kind.parent_kinds.length}</span></h3>
        <KindRows reference={reference} kinds={kind.parent_kinds} label={`Parents of ${kind.label}`} />
        <h3>Children <span className="section-count">{kind.child_kinds.length}</span></h3>
        <KindRows reference={reference} kinds={kind.child_kinds} label={`Children of ${kind.label}`} />
      </>
    ),
  };
}

function KindBody({ index, reference, kind }: { index: SpecIndex; reference: FormatReference; kind: KindReference }) {
  const spaces = useSpaces();
  const stage = reference.stages.find((s) => s.stage === kind.stage);
  const relations = relationsOf(reference, kind.kind);
  const checks = checksOf(reference, kind.kind);
  // The current space's records: `index` is the space's own, so no other product's are counted.
  const records = index.workspace.records.filter((r) => r.kind === kind.kind).sort(byIdOrder);
  const space = spaces?.current ?? null;
  const inSpace = space ? ` in ${space.title}` : '';
  const example = records[0];
  const groups = new Map<string, SpecRecord[]>();
  for (const r of records) if (r.parent) groups.set(r.parent, [...(groups.get(r.parent) ?? []), r]);
  const parents = [...groups.keys()].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  const name = lowerLabel(plural(kind.label));
  return (
    <>
      {kind.description ? <Markdown source={kind.description} /> : <p className="hint">This kind has no description.</p>}
      <Section title="Where it sits">
        <dl className="fields format-facts">
          <div><dt>Stage</dt><dd>{stage ? <>{stage.label}<span className="meta"> · {stage.description}</span></> : 'None: it sits outside the stages.'}</dd></div>
          <div><dt>Parent</dt><dd>{kind.parent_kinds.length === 0
            ? (kind.kind === 'product' ? 'None: a product holds everything else.' : kind.idScope === 'domain' ? 'None: it has no owner. Its product and domain follow from its ID.' : 'None: it has no owner. Its product follows from its ID; it belongs to the one domain that uses it, or is shared when two or more domains use it, or none.')
            : kind.parent_kinds.length === 1 ? 'Exactly one, of the kind below.' : 'Exactly one, of one of the kinds below.'}</dd></div>
        </dl>
        <Section level={3} title="Allowed parents" count={kind.parent_kinds.length}>
          {kind.parent_kinds.length > 0 && <KindRows reference={reference} kinds={kind.parent_kinds} label={`Allowed parents of ${kind.label}`} />}
        </Section>
        <Section level={3} title="Allowed children" count={kind.child_kinds.length}>
          <KindRows reference={reference} kinds={kind.child_kinds} label={`Allowed children of ${kind.label}`} />
        </Section>
      </Section>
      <section className="spec-section" id={FIELDS_ANCHOR} aria-labelledby="fields-heading">
        <header className="spec-section-head"><h2 id="fields-heading">Columns<span className="section-count">{kind.columns.length}</span></h2></header>
        <p>A {lowerLabel(kind.label)} is a row of the <code>{kind.kind}</code> table, in <code>{index.workspace.dataDir}/{kind.kind}.jsonl</code>. A required column must hold a value; the others may be left out.</p>
        <div className="table-scroll">
          <table className="data-table kind-columns">
            <caption className="sr-only">The columns of the {kind.kind} table</caption>
            <thead><tr><th scope="col">Column</th><th scope="col">Type</th><th scope="col">Required</th><th scope="col">Meaning</th></tr></thead>
            <tbody>
              {kind.columns.map((c) => (
                <tr key={c.name} id={fieldAnchor(c.name)}>
                  <th scope="row"><code>{c.name}</code></th>
                  <td>{columnType(c)}</td>
                  <td>{c.required ? 'yes' : 'no'}</td>
                  <td>{c.description ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {kind.parts.length > 0 && (
          <>
            <p>Its records also own rows of these tables, removed with them:</p>
            <ul className="plain field-list">
              {kind.parts.map((t) => <li key={t.table}><code>{t.table}</code>{t.description && <span className="meta"> · {t.description}</span>}</li>)}
            </ul>
          </>
        )}
        <dl className="fields format-facts">
          <div><dt>Obligation</dt><dd>{obligationText(kind.obligation)}</dd></div>
          <div><dt>ID</dt><dd>{kind.id ? <><code>{kind.id.pattern}</code>{kind.id.example && <>, such as <code>{kind.id.example}</code></>}</> : 'No convention given.'}</dd></div>
          {kind.idScope && <div><dt>ID starts with</dt><dd>{ID_SCOPE_TEXT[kind.idScope] ?? kind.idScope}</dd></div>}
        </dl>
      </section>
      <Section title="Links out" count={relations.out.length}>
        <RelationRows reference={reference} relations={relations.out} from="source" label={`Links out of a ${lowerLabel(kind.label)}`} />
      </Section>
      <Section title="Links in" count={relations.in.length}>
        <RelationRows reference={reference} relations={relations.in} from="target" label={`Links into a ${lowerLabel(kind.label)}`} />
      </Section>
      <Section title="Checks that concern it" count={checks.length}>
        {checks.length === 0
          ? <p className="hint">No check names this kind. The checks that apply to records of every kind still apply.</p>
          : <CheckRows index={index} checks={checks} label={`Checks that concern ${kind.label}`} />}
      </Section>
      <Section title="Example">
        {example ? (
          <>
            <p>The first {lowerLabel(kind.label)}{inSpace}, <RecordLink index={index} id={example.id} />, on line {example.line} of <code>{example.file}</code>:</p>
            <div className="markdown"><pre className="record-header" tabIndex={0}><code>{rowLineOf(example)}</code></pre></div>
          </>
        ) : <p className="hint">No record of this kind yet.</p>}
      </Section>
      <Section title="Records" count={records.length}>
        <p>{records.length === 0 ? `No ${name} yet.` : `${records.length} ${records.length === 1 ? lowerLabel(kind.label) : name}${inSpace}${parents.length > 0 ? ', under:' : '.'}`}</p>
        {parents.length > 0 && (
          <LongList
            label={`Where the ${name} are`}
            className="record-list"
            items={parents}
            itemKey={(p) => p}
            searchText={(p) => `${p} ${index.byId.get(p)?.title ?? ''}`}
            render={(p) => (
              <>
                {/* The parent's group of this kind when the tree has one, else the parent, whose page lists them. */}
                <Link to={addressOf(treeGroup(index, `${p}/${kind.kind}`) ? `${p}/${kind.kind}` : p)} className="record-link row-link">
                  <code>{p}</code>
                  <span>{index.byId.get(p)?.title ?? p}</span>
                </Link>
                <small className="meta">{groups.get(p)!.length}</small>
              </>
            )}
          />
        )}
      </Section>
    </>
  );
}

// ---------- /format/checks/<check> ----------

function checkPage({ index, reference }: PageProps, check: CheckReference, problems: Problem[]): Page {
  return {
    title: (
      <PageHeader eyebrow={<><Link to={formatPath}>Record format</Link> · Check · {check.severities.join(' or ')}</>} title={check.check}>
        <span className="row-tags"><SeverityTags check={check} /></span>
      </PageHeader>
    ),
    body: (
      <>
        {check.summary ? <Markdown source={check.summary} /> : <p className="hint">The engine reports this itself: it has no row in the check table.</p>}
        {check.explanation && <Markdown source={check.explanation} />}
        <dl className="fields format-facts">
          <div><dt>Severity</dt><dd><SeverityTags check={check} /></dd></div>
          <div><dt>From</dt><dd>{ORIGIN_TEXT[check.origin]}</dd></div>
        </dl>
        {check.query && (
          <Section title="Query">
            <div className="markdown"><pre className="check-query" tabIndex={0}><code>{check.query}</code></pre></div>
          </Section>
        )}
        {check.kinds.length > 0 && (
          <Section title="Kinds it concerns" count={check.kinds.length}>
            <KindRows reference={reference} kinds={check.kinds} label={`Kinds ${check.check} concerns`} />
          </Section>
        )}
        <Section title="Problems now" count={problems.length}>
          {problems.length === 0 ? <p className="hint">This check reports nothing now.</p> : <ProblemList index={index} problems={problems} showCheck={false} />}
        </Section>
      </>
    ),
    facts: (
      <>
        <div className="side-bar-identity">
          <p className="eyebrow">Check</p>
          <p className="side-bar-name">{check.check}</p>
        </div>
        <dl className="fields">
          <div><dt>Severity</dt><dd><SeverityTags check={check} /></dd></div>
          <div><dt>From</dt><dd>{ORIGIN_TEXT[check.origin]}</dd></div>
          <div><dt>Problems</dt><dd>{problems.length}</dd></div>
          <div><dt>Records</dt><dd>{new Set(problems.map((p) => p.record ?? 'workspace')).size}</dd></div>
        </dl>
        <h3>Kinds <span className="section-count">{check.kinds.length}</span></h3>
        {check.kinds.length === 0 ? <p className="hint">Records of any kind.</p> : <KindRows reference={reference} kinds={check.kinds} label={`Kinds ${check.check} concerns`} />}
      </>
    ),
  };
}
