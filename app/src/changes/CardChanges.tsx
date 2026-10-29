import type { SpecIndex } from '../specs/data';
import { Section } from '../specs/parts';
import { ChangeDetails, changeSummary } from './ChangeDetails';
import { useChanges } from './changes';

// The diff in the wiki card (LA-V96-R27): a record changed from the baseline the Reader picked has a Changes section,
// each changed field old → new and the links added and removed; one added since it says "New since <baseline>". The
// summary says it in a line; the whole page shows the section.

/** How the card names the baseline: "since the last commit (a1b2c3d Add the lens)". */
function sinceText(label: string, detail: string) {
  return <>{label} <span className="changes-since-detail">({detail})</span></>;
}

export function CardChanges({ index, id, summary = false }: { index: SpecIndex; id: string; summary?: boolean }) {
  const { byId, baseline } = useChanges();
  const change = byId.get(id);
  if (!change || baseline.state !== 'ok' || change.change === 'removed') return null;
  const since = sinceText(baseline.label, baseline.detail);
  if (change.change === 'added') return <p className="changes-line is-added" data-change="added"><span className="change-dot" aria-hidden="true" /> New {since}</p>;
  if (summary) return <p className="changes-line is-changed" data-change="changed"><span className="change-dot" aria-hidden="true" /> Changed {since}: {changeSummary(change)}</p>;
  return (
    <Section title="Changes" className="record-changes">
      <p className="hint">Changed {since}.</p>
      <ChangeDetails index={index} change={change} />
    </Section>
  );
}
