import { lowerLabel, plural as pluralOf } from '../plural';
import { createContext, Fragment, useContext, useState, type AnchorHTMLAttributes, type ReactNode } from 'react';
import { Link } from '../router';
import { checkPagePath } from '../format/reference';
import { gapsOf, textOf, kindLabel, partsOf, problemOrder, type Problem, type SpecIndex, type SpecRecord, type Stage } from './data';
import { groupRecords } from './groups';
import { addressOf } from '../views/address';
import { ActionsSlotContext } from '../components/ActionsSlot';
import { LongList } from '../components/LongList';
import { TreeList } from '../components/TreeList';

// Pieces shared by the spec pages and the record content.

/**
 * Where a spec link goes on a plain click. Null (the default) moves the whole app to the address;
 * a host that shows the record content inside another view (beside the graph, say) provides its own.
 */
export const NavigateContext = createContext<((to: string) => void) | null>(null);

/** A real <a href> that navigates through the host's onNavigate when there is one, and the app's router otherwise. */
export function SpecLink({ to, onClick, ...rest }: { to: string } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  const onNavigate = useContext(NavigateContext);
  return (
    <Link
      to={to}
      {...rest}
      onClick={(e) => {
        onClick?.(e);
        if (!onNavigate || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        onNavigate(to);
      }}
    />
  );
}

/** What a long list of records is searched by: the ID and the title. */
export const recordText = (r: SpecRecord) => `${r.id} ${r.title}`;
/** The text for a record ID, with its title when the record exists. */
export const idText = (index: SpecIndex, id: string) => `${id} ${index.byId.get(id)?.title ?? ''}`;

/**
 * A link to a record: its ID and, by default, its title. With `row`, it is its row's one link
 * (LA-PAT-APP-UX-R05): it stretches over the whole row, so anywhere on the row opens the record,
 * while the row's other controls sit above it and keep working.
 */
export function RecordLink({ index, id, showTitle = true, row = false }: { index: SpecIndex; id: string; showTitle?: boolean; row?: boolean }) {
  const record = index.byId.get(id);
  if (!record) return <span className="record-link missing" title="No record has this ID"><code>{id}</code></span>;
  return (
    <SpecLink to={addressOf(id)} className={row ? 'record-link row-link' : 'record-link'}>
      <code>{id}</code>
      {showTitle && <span>{record.title}</span>}
    </SpecLink>
  );
}

export function ProblemList({ index, problems, showRecord = true, showCheck = true }: { index: SpecIndex; problems: Problem[]; showRecord?: boolean; showCheck?: boolean }) {
  if (problems.length === 0) return <p className="hint">No problems.</p>;
  const items = [...problems].sort(problemOrder).map((p, i) => ({ p, key: String(i) }));
  return (
    <LongList
      label="Problems"
      className="problems"
      items={items}
      itemKey={(item) => item.key}
      itemClassName={({ p }) => `problem ${p.severity}`}
      searchText={({ p }) => `${p.record ?? 'workspace'} ${index.byId.get(p.record ?? '')?.title ?? ''} ${p.message} ${p.check}`}
      render={({ p }) => (
        <>
          <span className="severity">{p.severity}</span>
          <span className="problem-text">
            {showRecord && (p.record ? <RecordLink index={index} id={p.record} showTitle={false} row /> : <code>workspace</code>)}{' '}
            {p.message}
          </span>
          {showCheck && <SpecLink to={checkPagePath(p.check)} className="check-link" title={`How the ${p.check} check works`}><code className="check-name">{p.check}</code></SpecLink>}
        </>
      )}
    />
  );
}

export type SectionLevel = 2 | 3 | 4 | 5 | 6;

/** The heading level one below, kept at h6 at most. */
export const levelBelow = (level: SectionLevel): SectionLevel => Math.min(6, level + 1) as SectionLevel;

/**
 * A titled part of a page. Its header row holds the heading (h2, or h3 and h4 for a part within
 * a part, such as a folder of a domain page and a kind within it, down to h6 for groups within a
 * folder) and, at the right, any actions its contents offer (such as a list's "Expand all"). A
 * part that is a record (a layer) links its title to the record's page.
 */
export function Section({ title, titleTo, count, level = 2, className, children }: { title: string; titleTo?: string; count?: number; level?: SectionLevel; className?: string; children: ReactNode }) {
  const [actions, setActions] = useState<HTMLDivElement | null>(null);
  const Heading = `h${level}` as 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  return (
    <section className={className ? `spec-section ${className}` : 'spec-section'}>
      <header className="spec-section-head">
        <Heading>{titleTo ? <SpecLink to={titleTo}>{title}</SpecLink> : title}{count !== undefined && <span className="section-count">{count}</span>}</Heading>
        <div className="spec-section-actions" ref={setActions} />
      </header>
      <ActionsSlotContext.Provider value={actions}>{children}</ActionsSlotContext.Provider>
    </section>
  );
}

/**
 * Records under their group headings (lathe/REFERENCE.md): the ungrouped ones first, without a
 * heading, then each group as a part of the page at `level`, in the order the groups first appear.
 * Records that name no group are drawn once, as they would be without groups.
 */
export function Grouped<T extends SpecRecord>({ records, level, render }: { records: readonly T[]; level: SectionLevel; render: (records: T[], heading: string | null) => ReactNode }) {
  return (
    <>
      {groupRecords(records).map((g) => (g.heading === null
        ? <Fragment key="">{render(g.records, null)}</Fragment>
        : <Section key={g.key} title={g.heading} count={g.records.length} level={level} className="record-group">{render(g.records, g.heading)}</Section>))}
    </>
  );
}

export function PageHeader({ eyebrow, title, id, children }: { eyebrow: ReactNode; title: string; id?: string; children?: ReactNode }) {
  return (
    <header className="spec-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {id && <p className="record-id"><SpecLink to={addressOf(id)} className="record-link"><code>{id}</code></SpecLink></p>}
      </div>
      {children}
    </header>
  );
}

export function ProblemBadge({ problems }: { problems: Problem[] }) {
  if (problems.length === 0) return null;
  const errors = problems.filter((p) => p.severity === 'error').length;
  return (
    <span className={`badge ${errors ? 'error' : 'warning'}`} title={problems.map((p) => p.message).join('\n')}>
      {errors ? `${errors} error${errors > 1 ? 's' : ''}` : `${problems.length} warning${problems.length > 1 ? 's' : ''}`}
    </span>
  );
}

// ---------- Test states ----------

export type TestState = 'automated' | 'manual' | 'not automated yet';

const STATE_MEANING: Record<TestState, string> = {
  automated: 'Automated: a file runs it. It counts as proof.',
  manual: 'Manual: a person follows its procedure. It counts as proof.',
  'not automated yet': 'Not automated yet: no file runs it. It does not count as proof.',
};
/** The class a state's tag takes. */
const STATE_CLASS: Record<TestState, string> = { automated: 'automated', manual: 'manual', 'not automated yet': 'not-automated' };

/** Whether a kind is a test: one of the test plan's kinds with a run by (a test data set is in the test plan, and not a test). */
export const isTestKind = (index: SpecIndex, kind: string) => {
  const k = index.kinds.get(kind);
  return k?.stage === 'test-plan' && k.required_fields.includes('state');
};

/** A test's state, from its run by: automated, manual or not automated yet. */
export const testState = (record: SpecRecord): string => textOf(record.row, 'state').trim();

/** Whether a test is not automated yet, so it does not count as proof. */
export const notAutomatedYet = (record: SpecRecord) => testState(record) === 'not automated yet';

/** A small tag naming a test's state, and its level. A test not automated yet looks unfinished (dashed). */
export function TestStateTag({ record }: { record: SpecRecord }) {
  const state = testState(record);
  const known = state in STATE_MEANING;
  return (
    <span className={`test-state ${known ? STATE_CLASS[state as TestState] : 'unknown'}`} title={known ? STATE_MEANING[state as TestState] : 'Not a known test state.'}>
      {state}
    </span>
  );
}

/** A stage's color mark: a small square in the stage's color, hidden from assistive technology (the label beside it names the stage). */
export function StageMark({ stage }: { stage: Stage }) {
  return <span className={`stage-mark stage-${stage}`} aria-hidden="true" />;
}

/** A record's Stage fact, its color mark beside its stage's label; nothing for a kind outside the stages. */
export function StageFact({ index, kind }: { index: SpecIndex; kind: string }) {
  const stage = index.kinds.get(kind)?.stage;
  if (!stage) return null;
  const label = index.workspace.stages.find((s) => s.stage === stage)?.label ?? stage;
  return <div><dt>Stage</dt><dd><StageMark stage={stage} /> {label}</dd></div>;
}

/** A kind's name in its stage's color, as a badge: the kind's label, and its stage for assistive technology and the tooltip. */
export function KindBadge({ index, kind }: { index: SpecIndex; kind: string }) {
  const stage = index.kinds.get(kind)?.stage ?? null;
  const stageName = stage ? index.workspace.stages.find((s) => s.stage === stage)?.label ?? stage : null;
  return (
    <span className={`kind-badge ${stage ? `stage-${stage}` : 'stage-none'}`} title={stageName ? `${kindLabel(index, kind)}, in ${stageName}` : kindLabel(index, kind)}>
      {kindLabel(index, kind)}
    </span>
  );
}

// ---------- Record rows and trees ----------

/**
 * A coverage gap's `missing` in a few words: an obligation not designed, built or proved, or the minimum a record
 * misses, named by its gap rule ("use-case-without-flow" reads "use case without flow").
 */
export const gapText = (missing: string) =>
  missing === 'designed' || missing === 'built' || missing === 'proved' ? `not ${missing}` : missing.replaceAll('-', ' ');


// Fields worth showing in a list row, by kind; a technical record shows its file, a test its level and file.
const ROW_FIELDS: Record<string, string[]> = {
  endpoint: ['method', 'route'],
  view: ['route'],
  integration: ['system'],
  domain: ['subdomain_type'],
  table: ['name', 'storage'],
};

const rowFields = (index: SpecIndex, kind: string): string[] => {
  const stage = index.kinds.get(kind)?.stage;
  if (ROW_FIELDS[kind]) return ROW_FIELDS[kind];
  if (isTestKind(index, kind)) return ['level', 'file'];
  if (stage === 'test-plan') return ['file'];
  if (stage === 'technical-specification') return ['file'];
  return [];
};

/** One record as a list row: its link, a few fields, its test state, coverage marks and problems. */
export function RecordRowBody({ index, record, showKind = false }: { index: SpecIndex; record: SpecRecord; showKind?: boolean }) {
  // A use case's row names its actors; a published event says so.
  const actors = record.kind === 'use_case' ? partsOf(index, record.id, 'use_case_actor').map((a) => textOf(a, 'role_name')).join(', ') : '';
  const published = record.kind === 'domain_event' && record.row.published === true ? 'published' : '';
  const isTest = isTestKind(index, record.kind);
  const fields = [actors, published, ...rowFields(index, record.kind).map((f) => textOf(record.row, f))].filter(Boolean);
  const gaps = gapsOf(index, record.id);
  return (
    <div className={`record-row ${isTest && notAutomatedYet(record) ? 'not-automated' : ''}`}>
      <RecordLink index={index} id={record.id} row />
      <span className="row-tags">
        {showKind && <small className="meta">{index.kinds.get(record.kind)?.label ?? record.kind}</small>}
        {fields.length > 0 && <small className="meta">{fields.join(' · ')}</small>}
        {isTest && <TestStateTag record={record} />}
        {(index.outgoing.get(record.id) ?? []).filter((l) => l.relation === 'follows').map((l) => (
          <span key={l.target} className="pattern-tag" title={`Follows the pattern ${l.target}`}>{index.byId.get(l.target)?.title ?? l.target}</span>
        ))}
        {gaps.map((g) => <span key={g} className="badge warning">{gapText(g)}</span>)}
        <ProblemBadge problems={index.problemsFor.get(record.id) ?? []} />
      </span>
    </div>
  );
}

const plural = (label: string, n: number) => (n === 1 ? lowerLabel(label) : pluralOf(lowerLabel(label)));

/** "4 requirements", or "3 children" when the nested records are of several kinds. */
export function nestedCount(index: SpecIndex, nested: readonly SpecRecord[]): string {
  const kinds = new Set(nested.map((n) => n.kind));
  if (kinds.size === 1) return `${nested.length} ${plural(index.kinds.get(nested[0].kind)?.label ?? nested[0].kind, nested.length)}`;
  return `${nested.length} ${nested.length === 1 ? 'child' : 'children'}`;
}

/**
 * What a list of records is titled: its one kind in the plural ("Domain rules", "UC requirements"),
 * or `mixed` ("Children", "Members") when it holds more than one kind to tell apart.
 */
export function listTitle(index: SpecIndex, records: readonly SpecRecord[], mixed: string): string {
  const kinds = new Set(records.map((r) => r.kind));
  return kinds.size === 1 ? pluralOf(kindLabel(index, records[0].kind)) : mixed;
}

/**
 * Records one level below the page's record, each with its own children folded under it: the
 * shape of every list of children on a wiki page and in the side bar. With `showKind`, each row
 * names its kind, but only when the list holds more than one kind.
 */
export function RecordTree({ index, records, label, query, showKind = false, bulk = true, nested }: {
  index: SpecIndex;
  records: readonly SpecRecord[];
  label: string;
  query?: string;
  showKind?: boolean;
  bulk?: boolean;
  /** What folds under a row: its children by default; a stage's folder folds only those of its stage. */
  nested?: (record: SpecRecord) => SpecRecord[];
}) {
  // Rows are told apart by kind only when there is more than one kind to tell apart.
  const tagKinds = showKind && new Set(records.map((r) => r.kind)).size > 1;
  const nestedOf = nested ?? ((r: SpecRecord) => index.children.get(r.id) ?? []);
  return (
    <TreeList
      label={label}
      items={records}
      itemKey={(r) => r.id}
      nestedOf={nestedOf}
      renderRow={(r) => <RecordRowBody index={index} record={r} showKind={tagKinds} />}
      searchText={recordText}
      countLabel={(_, inner) => nestedCount(index, inner)}
      nestedLabel={(r) => `${listTitle(index, nestedOf(r), 'Children')} of ${r.id}`}
      query={query}
      bulk={bulk}
    />
  );
}
