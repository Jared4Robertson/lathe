import { useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { type RecordIndex, type RecordSummary } from '../exploring/record-summaries/record-index';
import { Section } from '../specs/parts';
import './RecordHistory.css';
import { changeSummary, fetchHistory, shortDate, valueText, type HistoryAnswer, type HistoryChange, type HistoryCommit } from './history';

// A record's History, at the end of its whole page in the wiki card (LA-V96-R26): the commits that
// changed the record's rows (its own row, the part rows it owns and the links it starts) in their
// data files, newest first, with "Load more", and the changes not committed yet first, labeled so.
// Each says what it changed; choosing one shows each changed field before and after. Git is read
// only once the Reader asks, with "Show the history"; the list then reloads with the data, so an
// edit shows up as "Not committed" at once.

type Loaded = { answer: HistoryAnswer; commits: HistoryCommit[]; more: boolean };

const WORKING = 'working';

/** The History section of a record's whole page: a button that reads it, then the list. */
export function HistorySection({ index, id }: { index: RecordIndex; id: string }) {
  const [shown, setShown] = useState(false);
  useEffect(() => { setShown(false); }, [id]);
  return (
    <Section title="History" className="record-history">
      {shown ? <RecordHistory index={index} id={id} /> : (
        <p><Button onClick={() => setShown(true)}>Show the history</Button></p>
      )}
    </Section>
  );
}

function RecordHistory({ index, id }: { index: RecordIndex; id: string }) {
  const record = index.byId.get(id);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    setOpen(null);
    setError(null);
    setLoaded(null);
    if (!record) return;
    const abort = new AbortController();
    fetchHistory(record.id, 0, abort.signal).then(
      (answer) => setLoaded({ answer, commits: answer.state === 'ok' ? answer.commits : [], more: answer.state === 'ok' && answer.more }),
      (e) => { if (!abort.signal.aborted) setError(e instanceof Error ? e.message : String(e)); },
    );
    return () => abort.abort();
  }, [record?.id, index]);

  if (!record) return <p className="hint">There's no record <code>{id}</code>.</p>;
  if (error) return <p className="hint">History isn't available here: {error}</p>;
  if (!loaded) return <p className="hint" role="status">Reading the history of <code>{record.file}</code>…</p>;
  const { answer } = loaded;
  if (answer.state === 'no-repo') return <><Files files={answer.files} /><p className="hint">{answer.message}</p></>;
  if (answer.state !== 'ok') return <p className="hint">There's no record <code>{id}</code> in the data on disk yet.</p>;

  const loadMore = () => {
    setLoadingMore(true);
    fetchHistory(record.id, loaded.commits.length).then(
      (next) => {
        if (next.state === 'ok') setLoaded((l) => l && { ...l, commits: [...l.commits, ...next.commits], more: next.more });
        setLoadingMore(false);
      },
      (e) => { setError(e instanceof Error ? e.message : String(e)); setLoadingMore(false); },
    );
  };
  const empty = loaded.commits.length === 0 && answer.uncommitted.length === 0;
  return (
    <>
      <Files files={answer.files} />
      {empty ? <p className="hint">No commit has changed this record yet.</p> : (
        <ul className="plain history-list" aria-label={`Commits that changed ${record.id}`}>
          {answer.uncommitted.length > 0 && (
            <HistoryRow
              record={record}
              commit={WORKING}
              open={open === WORKING}
              onToggle={() => setOpen(open === WORKING ? null : WORKING)}
              subject="Not committed"
              meta="Changes in the working tree"
              changes={answer.uncommitted}
              truncated={false}
              working
            />
          )}
          {loaded.commits.map((c) => (
            <HistoryRow
              key={c.hash}
              record={record}
              commit={c.hash}
              open={open === c.hash}
              onToggle={() => setOpen(open === c.hash ? null : c.hash)}
              subject={c.subject || '(no subject)'}
              meta={`${shortDate(c.date)} · ${c.author} · ${c.short}`}
              changes={c.changes}
              truncated={c.truncated}
            />
          ))}
        </ul>
      )}
      {loaded.more && (
        <p className="history-more">
          <Button onClick={loadMore} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Load more'}</Button>
        </p>
      )}
    </>
  );
}

function Files({ files }: { files: string[] }) {
  return <p className="history-files" title="The data files that hold the record's rows">{files.map((f, i) => <span key={f}>{i > 0 && ' '}<code>{f}</code></span>)}</p>;
}

/** Which of the record's rows a change is about: the record itself, one of its parts, or a link it starts. */
function rowName(record: RecordSummary, change: HistoryChange): string {
  if (change.table === record.kind) return 'The record';
  return `${change.table.replaceAll('_', ' ')} (${change.key})`;
}

function HistoryRow({ record, commit, open, onToggle, subject, meta, changes, truncated, working = false }: {
  record: RecordSummary; commit: string; open: boolean; onToggle: () => void; subject: string; meta: string; changes: HistoryChange[]; truncated: boolean; working?: boolean;
}) {
  const detailId = `history-changes-${commit}`;
  const summary = changes.map((c) => `${c.table === record.kind ? '' : `${c.table.replaceAll('_', ' ')}: `}${changeSummary(c)}`).join(' · ');
  return (
    <li className={`history-row${working ? ' is-working' : ''}${open ? ' is-open' : ''}`}>
      <Button className="history-commit" aria-expanded={open} aria-controls={open ? detailId : undefined} onClick={onToggle}>
        <span className="history-subject">{subject}</span>
        <small className="history-meta">{meta}</small>
        {summary && <small className="history-summary">{summary}</small>}
      </Button>
      {open && (
        <div id={detailId} className="history-changes" role="region" aria-label={working ? 'Uncommitted changes' : `Changes in ${commit.slice(0, 7)}`}>
          {changes.map((c) => (
            <section key={`${c.table} ${c.key}`} className={`history-change is-${c.change}`}>
              <h4>{rowName(record, c)} <small>{c.change}</small></h4>
              <dl className="fields history-fields">
                {c.fields.map((f) => (
                  <div key={f.name}>
                    <dt>{f.name.replaceAll('_', ' ')}</dt>
                    <dd>
                      {f.before !== undefined && <del className="history-before">{valueText(f.before)}</del>}
                      {f.after !== undefined && <ins className="history-after">{valueText(f.after)}</ins>}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
          {truncated && <p className="hint">This commit's diff is too long to read whole, so some changes may be missing.</p>}
        </div>
      )}
    </li>
  );
}
