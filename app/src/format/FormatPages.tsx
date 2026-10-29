import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { AddCheck } from '../checking/check/CheckEditor';
import { CheckPage } from '../checking/check/CheckPage';
import { LongList } from '../components/LongList';
import { lowerLabel, plural } from '../plural';
import { Link, useLocation } from '../router';
import { useSpaces } from '../shell/spaces';
import { addressOf } from '../views/address';
import { treeGroup } from '../graph/tree';
import { byIdOrder, type Problem, type SpecIndex, type SpecRecord, type Stage } from '../specs/data';
import { Markdown } from '../specs/Markdown';
import { RecordLink, Section } from '../specs/parts';
import {
  FIELDS_ANCHOR,
  ID_SCOPE_TEXT,
  checkPagePath,
  checksOf,
  columnType,
  fieldAnchor,
  findCheck,
  findKind,
  formatPath,
  kindPagePath,
  obligationText,
  obligationShort,
  relationWords,
  relationsOf,
  stageName,
  useFormat,
  type CheckReference,
  type FormatReference,
  type FormatRoute,
  type KindReference,
  type RelationReference,
} from './reference';
import './format.css';

// The format reference's pages (LA-AUT-UC14): the record format (the concepts, then an index of the
// kinds by stage, the relations, and the checks by severity), a kind's page and a check's page. Each
// opens in the wiki card over the stage, the whole page, the stage keeping its focus (views/overlays.ts):
// a link to one is `?page=format/kinds/<kind>` on the current address. The pages read the schema and
// the check rows served with the data, so a product's own kinds and checks show; a check's page body is the Check
// aggregate's own (checking/check/CheckPage.tsx), read through its query, and a product's checks are added from the
// Checks here (AddCheck).

interface PageProps {
  index: SpecIndex;
  reference: FormatReference;
}

/** A format page as the wiki card shows it: its kind line, its title, any tags beside the title, and its body. */
interface FormatPage {
  eyebrow: ReactNode;
  title: string;
  tags?: ReactNode;
  body: ReactNode;
}

/**
 * A format page in the wiki card: its kind line and title as the card heads a record's page, then its
 * body. It starts at the top, or at the part the address names (`#fields`, `#field-title`).
 */
export function FormatPageView({ index, route }: { index: SpecIndex; route: FormatRoute }) {
  const reference = useFormat(index);
  const { hash } = useLocation();
  const box = useRef<HTMLDivElement>(null);
  const key = JSON.stringify(route);
  useLayoutEffect(() => {
    const scroller = box.current?.closest<HTMLElement>('.wiki-panel-scroll');
    const id = (() => { try { return decodeURIComponent(hash.slice(1)); } catch { return ''; } })();
    const target = id ? document.getElementById(id) : null;
    if (target && box.current?.contains(target)) target.scrollIntoView?.({ block: 'start' });
    else if (scroller) scroller.scrollTop = 0;
  }, [key, hash]);
  if (!reference) return null;
  const page = formatPageFor({ index, reference }, route);
  return (
    <div ref={box} className="format-page">
      <header className="wiki-panel-title spec-header">
        <div>
          <p className="wiki-panel-kind">{page.eyebrow}</p>
          <h2>{page.title}</h2>
        </div>
        {page.tags}
      </header>
      <div className="spec-body">{page.body}</div>
    </div>
  );
}

function formatPageFor(props: PageProps, route: FormatRoute): FormatPage {
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

function missingPage(what: 'kind' | 'check', name: string): FormatPage {
  return {
    eyebrow: <><Link to={formatPath}>Record format</Link> · {what === 'kind' ? 'Kind' : 'Check'}</>,
    title: name,
    body: <div className="placeholder"><p>The format has no {what} called <code>{name}</code>. <Link to={formatPath}>See every kind and check</Link>.</p></div>,
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

// ---------- The record format ----------

function homePage({ index, reference }: PageProps): FormatPage {
  const errors = reference.checks.filter((c) => c.severity === 'error');
  const warnings = reference.checks.filter((c) => c.severity === 'warning');
  return {
    eyebrow: 'Reference · read from the schema',
    title: 'Record format',
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
          <AddCheck index={index} />
          <Section level={3} title="Errors" count={errors.length}><CheckRows index={index} checks={errors} label="Error checks" /></Section>
          <Section level={3} title="Warnings" count={warnings.length}><CheckRows index={index} checks={warnings} label="Warning checks" /></Section>
        </section>
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

// ---------- A kind's page ----------

/** A record's row as its data file holds it: one JSON object on one line. */
export const rowLineOf = (record: SpecRecord) => JSON.stringify(record.row);

function kindPage({ index, reference }: PageProps, kind: KindReference): FormatPage {
  return {
    eyebrow: <><Link to={formatPath}>Record format</Link> · Kind · {stageName(reference, kind.stage)}</>,
    title: kind.label,
    body: <KindBody index={index} reference={reference} kind={kind} />,
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

// ---------- A check's page ----------

function checkPage({ index, reference }: PageProps, check: CheckReference, problems: Problem[]): FormatPage {
  return {
    eyebrow: <><Link to={formatPath}>Record format</Link> · Check · {check.severities.join(' or ')}</>,
    title: check.check,
    tags: <span className="row-tags"><SeverityTags check={check} /></span>,
    body: <CheckPage index={index} check={check} problems={problems} kindRows={(kinds) => <KindRows reference={reference} kinds={kinds} label={`Kinds ${check.check} concerns`} />} />,
  };
}
