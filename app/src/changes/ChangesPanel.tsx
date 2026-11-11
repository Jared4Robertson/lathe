import { useEffect, useState } from 'react';
import { Card, CardGrid } from '../shell/Card';
import { lowerLabel } from '../plural';
import { kindLabel, type RecordIndex } from '../exploring/record-summaries/record-index';
import { addressOf } from '../views/address';
import { ToolPanelFrame } from '../views/ToolPanel';
import { CHANGE_LABEL, ChangeDetails, changeSummary, SincePicker } from './ChangeDetails';
import { ago, changesLatestFirst, countsText, useChanges, type RecordChange } from './changes';
import { useLiveVersion } from './marks';

// The Changes panel (LA-V100), Tools › Changes: a tool over the stage (LA-PAT-APP-UX-R20) at `?panel=changes` on
// whatever focus the stage shows. It lists the product's changes from the baseline the Reader picked, by record,
// newest first: the records that changed while the page was open first, by when they landed, then the rest by ID.
// Each is a card: its kind, ID and title, what changed and when, and the fields old → new; a click focuses it on the
// stage, the panel staying open. A removed record has no page, so its card opens what it was. On a phone it is a bottom sheet.

/** How often the "4 min ago" times are written again, in ms. */
const TICK_MS = 30_000;

export interface ChangesPanelProps {
  /** The current space's index. */
  index: RecordIndex;
  /** The record in focus on the stage, whose card is marked. */
  focus: string | null;
  sheet: boolean;
  onClose: () => void;
}

export function ChangesPanel({ index, focus, sheet, onClose }: ChangesPanelProps) {
  const { changes, baseline, live } = useChanges();
  useLiveVersion();
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), TICK_MS); return () => clearInterval(t); }, []);
  const at = (c: RecordChange) => live.get(c.id)?.at ?? null;
  const ordered = changesLatestFirst(changes, live);
  const counts = <p className="changes-count">{baseline.state === 'ok' ? countsText(changes) : ''}</p>;
  return (
    <ToolPanelFrame label="Changes" head={counts} className="changes-panel" sheet={sheet} onClose={onClose}>
      <div className="spec-body">
        <SincePicker className="is-panel" />
        {baseline.state === 'loading' && <p className="hint" role="status">Reading the baseline…</p>}
        {baseline.state === 'none' && <p className="hint">{baseline.message}</p>}
        {baseline.state === 'ok' && (
          <>
            <p className="hint">Compared with {baseline.detail}.</p>
            {ordered.length === 0
              ? <p className="hint">Nothing has changed {baseline.label}.</p>
              : (
                <CardGrid stack label="Changed records">
                  {ordered.map((c) => <ChangeCard key={c.id} index={index} change={c} current={c.id === focus} when={at(c)} now={now} />)}
                </CardGrid>
              )}
          </>
        )}
      </div>
    </ToolPanelFrame>
  );
}

function ChangeCard({ index, change, current, when, now }: { index: RecordIndex; change: RecordChange; current: boolean; when: number | null; now: number }) {
  const [open, setOpen] = useState(false);
  const title = <><span className="changes-kind">{kindLabel(index, change.kind)}</span> <code>{change.id}</code> {change.title}</>;
  const what = (
    <p className={`changes-what is-${change.change}`}>
      <span className="change-dot" aria-hidden="true" />
      {CHANGE_LABEL[change.change]}{change.change === 'changed' && `: ${changeSummary(change)}`}
      {when !== null && <span className="changes-when"> · {ago(when, now)}</span>}
    </p>
  );
  if (change.change === 'removed') {
    return (
      <Card onActivate={() => setOpen(!open)} pressed={open} label={`${change.id} ${change.title}, removed: ${open ? 'hide' : 'show'} what it was`} title={title} look="compact">
        {what}
        {open && <p className="hint">Removed: it is no longer in the data, so it has no page. It was a {lowerLabel(kindLabel(index, change.kind))} titled “{change.title}”.</p>}
      </Card>
    );
  }
  return (
    <Card href={addressOf(change.id)} current={current} title={title} look="compact" data={{ 'data-change-id': change.id }}>
      {what}
      <ChangeDetails index={index} change={change} />
    </Card>
  );
}
