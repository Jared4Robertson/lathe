import { useEffect, useState } from 'react';
import { Button } from '../components/Button';
import type { SpecIndex } from '../specs/data';
import { diffLines, fetchDiff, fetchHistory, shortDate, WORKING, type DiffAnswer, type HistoryAnswer, type HistoryCommit } from './history';

// The side bar's History (LA-EXP-UC12-R05): the commits that touched the record's spec file,
// newest first, with "Load more", and the changes not committed yet first, labeled so. Choosing
// one shows that commit's diff of the file inline. The list reloads with the specs, so an edit
// shows up as "Not committed" without a reload.

type Loaded = { answer: HistoryAnswer; commits: HistoryCommit[]; more: boolean };

export function SideBarHistory({ index, id }: { index: SpecIndex; id: string | null }) {
  const record = id ? index.byId.get(id) : undefined;
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

  if (!id) return <p className="hint">A group has no spec file of its own, so it has no history. Open one of its records to see its history.</p>;
  if (!record) return <p className="hint">There's no record <code>{id}</code>.</p>;
  if (error) return <p className="hint">History isn't available here: {error}</p>;
  if (!loaded) return <p className="hint" role="status">Reading the history of <code>{record.path}</code>…</p>;
  const { answer } = loaded;
  if (answer.state === 'no-repo') return <><p className="side-file"><code>{answer.file}</code></p><p className="hint">{answer.message}</p></>;
  if (answer.state !== 'ok') return <p className="hint">There's no record <code>{id}</code> in the specs on disk yet.</p>;

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
  const empty = loaded.commits.length === 0 && !answer.uncommitted;
  return (
    <>
      <p className="side-file" title="The record's spec file"><code>{answer.file}</code></p>
      {empty ? <p className="hint">No commit has touched this file yet.</p> : (
        <ul className="plain history-list" aria-label={`Commits that touched ${answer.file}`}>
          {answer.uncommitted && (
            <HistoryRow
              id={record.id}
              commit={WORKING}
              open={open === WORKING}
              onToggle={() => setOpen(open === WORKING ? null : WORKING)}
              subject={answer.uncommitted === 'added' ? 'Not committed: a new file' : 'Not committed'}
              meta="Changes in the working tree"
              working
            />
          )}
          {loaded.commits.map((c) => (
            <HistoryRow
              key={c.hash}
              id={record.id}
              commit={c.hash}
              open={open === c.hash}
              onToggle={() => setOpen(open === c.hash ? null : c.hash)}
              subject={c.subject || '(no subject)'}
              meta={`${shortDate(c.date)} · ${c.author} · ${c.short}`}
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

function HistoryRow({ id, commit, open, onToggle, subject, meta, working = false }: {
  id: string; commit: string; open: boolean; onToggle: () => void; subject: string; meta: string; working?: boolean;
}) {
  const diffId = `history-diff-${commit}`;
  return (
    <li className={`history-row${working ? ' is-working' : ''}${open ? ' is-open' : ''}`}>
      <Button className="history-commit" aria-expanded={open} aria-controls={open ? diffId : undefined} onClick={onToggle}>
        <span className="history-subject">{subject}</span>
        <small className="history-meta">{meta}</small>
      </Button>
      {open && <div id={diffId}><CommitDiff id={id} commit={commit} /></div>}
    </li>
  );
}

function CommitDiff({ id, commit }: { id: string; commit: string }) {
  const [answer, setAnswer] = useState<DiffAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    fetchDiff(id, commit, abort.signal).then(setAnswer, (e) => { if (!abort.signal.aborted) setError(e instanceof Error ? e.message : String(e)); });
    return () => abort.abort();
  }, [id, commit]);
  if (error) return <p className="hint">Couldn't read the diff: {error}</p>;
  if (!answer) return <p className="hint" role="status">Reading the diff…</p>;
  if (answer.state !== 'ok') return <p className="hint">{answer.state === 'no-repo' ? answer.message : 'This commit did not change the file.'}</p>;
  if (!answer.diff.trim()) return <p className="hint">No changes to show.</p>;
  const lines = diffLines(answer.diff);
  return (
    <>
      <pre className="history-diff" aria-label={commit === WORKING ? 'Uncommitted changes' : `Diff of ${commit.slice(0, 7)}`} tabIndex={0}>
        {lines.map((l, i) => <span key={i} className={`diff-line diff-${l.kind}`}>{l.text || ' '}{'\n'}</span>)}
      </pre>
      {answer.truncated && <p className="hint">The diff is cut short: it is too long to show here.</p>}
    </>
  );
}
