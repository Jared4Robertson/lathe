import { plural as pluralOf } from '../plural';
import { createContext, useContext, type AnchorHTMLAttributes, type ReactNode } from 'react';
import { Link } from '../router';
import { problemOrder, recordPath, type Problem, type SpecIndex, type SpecRecord } from './data';
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

export function RecordLink({ index, id, showTitle = true }: { index: SpecIndex; id: string; showTitle?: boolean }) {
  const record = index.byId.get(id);
  if (!record) return <span className="record-link missing" title="No record has this ID"><code>{id}</code></span>;
  return (
    <SpecLink to={recordPath(id)} className="record-link">
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
            {showRecord && (p.record ? <RecordLink index={index} id={p.record} showTitle={false} /> : <code>workspace</code>)}{' '}
            {p.message}
          </span>
          {showCheck && <code className="check-name">{p.check}</code>}
        </>
      )}
    />
  );
}

export function Section({ title, count, level = 2, className, children }: { title: string; count?: number; level?: 2 | 3 | 4; className?: string; children: ReactNode }) {
  const Heading = `h${level}` as 'h2' | 'h3' | 'h4';
  return (
    <section className={className ? `spec-section ${className}` : 'spec-section'}>
      <Heading>{title}{count !== undefined && <span className="section-count">{count}</span>}</Heading>
      {children}
    </section>
  );
}

export function PageHeader({ eyebrow, title, id, children }: { eyebrow: ReactNode; title: string; id?: string; children?: ReactNode }) {
  return (
    <header className="spec-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {id && <p className="record-id"><SpecLink to={recordPath(id)} className="record-link"><code>{id}</code></SpecLink></p>}
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

export type TestState = 'automated' | 'manual' | 'planned';

const STATE_MEANING: Record<TestState, string> = {
  automated: 'Automated: a file runs it. It counts as proof.',
  manual: 'Manual: a person follows its procedure. It counts as proof.',
  planned: 'Planned: not written yet. It does not count as proof.',
};

/** A test's state: automated when the field is absent, as FORMAT.md section 4 says. Any other value is shown as written. */
export const testState = (record: SpecRecord): string => record.fields.state?.trim() || 'automated';

/** A small tag naming a test's state. A planned test's tag looks unfinished (dashed). */
export function TestStateTag({ record }: { record: SpecRecord }) {
  const state = testState(record);
  const known = state in STATE_MEANING;
  return (
    <span className={`test-state ${known ? state : 'unknown'}`} title={known ? STATE_MEANING[state as TestState] : 'Not a known test state.'}>
      {state}
    </span>
  );
}

// ---------- Record rows and trees ----------

/** The coverage gaps of one record: what is missing ('satisfies' or 'proves'). */
export function gapsOf(index: SpecIndex, id: string): string[] {
  const domain = index.byId.get(id)?.domain;
  if (!domain) return [];
  return (index.coverage.get(domain)?.gaps ?? []).filter((g) => g.id === id).map((g) => g.missing);
}

// Fields worth showing in a list row, by kind.
const ROW_FIELDS: Record<string, string[]> = {
  use_case: ['actor'],
  endpoint: ['method', 'route'],
  component: ['component_type', 'file'],
  test: ['test_type', 'run_by'],
};

/** One record as a list row: its link, a few fields, its test state, coverage marks and problems. */
export function RecordRowBody({ index, record, showKind = false }: { index: SpecIndex; record: SpecRecord; showKind?: boolean }) {
  const fields = (ROW_FIELDS[record.kind] ?? []).map((f) => record.fields[f]).filter(Boolean);
  const isTest = record.kind === 'test';
  const gaps = gapsOf(index, record.id);
  return (
    <div className={`record-row ${isTest && testState(record) === 'planned' ? 'planned' : ''}`}>
      <RecordLink index={index} id={record.id} />
      <span className="row-tags">
        {showKind && <small className="meta">{index.kinds.get(record.kind)?.label ?? record.kind}</small>}
        {fields.length > 0 && <small className="meta">{fields.join(' · ')}</small>}
        {isTest && <TestStateTag record={record} />}
        {(index.outgoing.get(record.id) ?? []).filter((l) => l.relation === 'follows').map((l) => (
          <span key={l.target} className="pattern-tag" title={`Follows the pattern ${l.target}`}>{index.byId.get(l.target)?.title ?? l.target}</span>
        ))}
        {gaps.map((g) => <span key={g} className="badge warning">{g === 'satisfies' ? 'not satisfied' : 'not proved'}</span>)}
        <ProblemBadge problems={index.problemsFor.get(record.id) ?? []} />
      </span>
    </div>
  );
}

const plural = (label: string, n: number) => (n === 1 ? label.toLowerCase() : pluralOf(label.toLowerCase()));

/** "4 requirements", or "3 children" when the nested records are of several kinds. */
export function nestedCount(index: SpecIndex, nested: readonly SpecRecord[]): string {
  const kinds = new Set(nested.map((n) => n.kind));
  if (kinds.size === 1) return `${nested.length} ${plural(index.kinds.get(nested[0].kind)?.label ?? nested[0].kind, nested.length)}`;
  return `${nested.length} ${nested.length === 1 ? 'child' : 'children'}`;
}

/**
 * Records one level below the page's record, each with its own children folded under it: the
 * shape of every list of children on a wiki page and in the inspector.
 */
export function RecordTree({ index, records, label, query, showKind = false, bulk = true }: {
  index: SpecIndex;
  records: readonly SpecRecord[];
  label: string;
  query?: string;
  showKind?: boolean;
  bulk?: boolean;
}) {
  return (
    <TreeList
      label={label}
      items={records}
      itemKey={(r) => r.id}
      nestedOf={(r) => index.children.get(r.id) ?? []}
      renderRow={(r) => <RecordRowBody index={index} record={r} showKind={showKind} />}
      searchText={recordText}
      countLabel={(_, nested) => nestedCount(index, nested)}
      nestedLabel={(r) => `Children of ${r.id}`}
      query={query}
      bulk={bulk}
    />
  );
}
