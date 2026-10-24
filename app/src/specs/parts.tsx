import { createContext, useContext, type AnchorHTMLAttributes, type ReactNode } from 'react';
import { Link } from '../router';
import { problemOrder, recordPath, type Problem, type SpecIndex, type SpecRecord } from './data';
import { LongList } from './LongList';

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

export function Section({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <section className="spec-section">
      <h2>{title}{count !== undefined && <span className="section-count">{count}</span>}</h2>
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
