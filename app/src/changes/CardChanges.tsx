import { type RecordIndex } from '../exploring/record-summaries/record-index';
import { Section } from '../specs/parts';
import { ChangeDetails, changeSummary } from './ChangeDetails';
import { useChanges } from './changes';

// The diff in the wiki card (LA-V96-R27): a record changed from the baseline the Reader picked has a Changes section,
// each changed field old → new and the links added and removed; one added since it says "New since <baseline>". The
// folded card's summary says it in a line and shows the same diff; the whole page shows it as a Changes section.

/** How the card names the baseline: "since the last commit (a1b2c3d Add the highlight)". */
function sinceText(label: string, detail: string) {
  return <>{label} <span className="changes-since-detail">({detail})</span></>;
}

export function CardChanges({ index, id, summary = false }: { index: RecordIndex; id: string; summary?: boolean }) {
  const { byId, baseline } = useChanges();
  const change = byId.get(id);
  if (!change || baseline.state !== 'ok' || change.change === 'removed') return null;
  const since = sinceText(baseline.label, baseline.detail);
  if (change.change === 'added') return <p className="changes-line is-added" data-change="added"><span className="change-dot" aria-hidden="true" /> New {since}</p>;
  // The folded card shows the diff as it is: each changed field and link, old → new, under the line that says it changed.
  if (summary) {
    return (
      <div className="changes-summary" data-change="changed">
        <p className="changes-line is-changed"><span className="change-dot" aria-hidden="true" /> Changed {since}: {changeSummary(change)}</p>
        <ChangeDetails index={index} change={change} />
      </div>
    );
  }
  return (
    <Section title="Changes" className="record-changes">
      <p className="hint">Changed {since}.</p>
      <ChangeDetails index={index} change={change} />
    </Section>
  );
}
