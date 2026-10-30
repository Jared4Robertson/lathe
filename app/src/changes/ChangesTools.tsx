import { Button } from '../components/Button';
import { navigate, useLocation } from '../router';
import { useAnnounce, useCommand } from '../shell/commands';
import { Tooltip } from '../shell/Tooltip';
import { overlaysOf, panelHref } from '../views/overlays';
import { useLiveVersion } from './marks';
import { SincePicker } from './ChangeDetails';
import { changeCounts, useChanges } from './changes';

// The Changes controls every stage shows (LA-V96-R28), the same on the Graph, the ERD and the Trace: Highlight changes
// (dim everything unchanged from the baseline), the baseline it compares with, Follow (glide to each change as it
// lands), and the Changes panel's toggle with how many records changed. They are the stage's, not one stage's, so
// the shared stage toolbar holds them (views/StageChrome.tsx), after its shared controls; the baseline picker shows in
// its widest form only (and in the More menu, the first group a narrower toolbar folds there), and is always in the
// Changes panel.

export function ChangesTools({ picker }: { picker: boolean }) {
  const c = useChanges();
  const { search } = useLocation();
  const announce = useAnnounce();
  useLiveVersion();
  const n = changeCounts(c.changes);
  const total = n.added + n.changed + n.removed;
  const open = overlaysOf(search).panel === 'changes';
  const toggleHighlight = () => { c.setHighlight(!c.highlight); announce(c.highlight ? 'Highlight changes off' : 'Highlight changes on: everything unchanged is dimmed'); };
  const toggleFollow = () => { c.setFollow(!c.follow); announce(c.follow ? 'Follow off' : 'Follow on: the camera glides to each change as it lands'); };
  const togglePanel = () => navigate(open ? panelHref(null) : panelHref('changes'));
  useCommand('toggleHighlightChanges', toggleHighlight, c.product !== null);
  useCommand('toggleFollow', toggleFollow, c.product !== null);
  return (
    <div className="changes-tools" role="group" aria-label="Changes">
      <Tooltip label={c.highlight ? 'Show everything again' : 'Dim everything unchanged'} command="toggleHighlightChanges">
        <Button className="changes-highlight" aria-pressed={c.highlight} onClick={toggleHighlight}>Highlight changes</Button>
      </Tooltip>
      {picker && <SincePicker />}
      <Tooltip label={c.follow ? 'Stop following the changes' : 'Glide to each change as it lands'} command="toggleFollow">
        <Button className="changes-follow" aria-pressed={c.follow} onClick={toggleFollow}>Follow</Button>
      </Tooltip>
      <Tooltip label={open ? 'Close the Changes panel' : 'Open the Changes panel: every change, newest first'} command="openChanges">
        <Button className="changes-open" aria-expanded={open} onClick={togglePanel}>
          Changes <span className={`section-count${total ? ' is-on' : ''}`} aria-label={`${total} ${total === 1 ? 'record' : 'records'} changed`}>{total}</span>
        </Button>
      </Tooltip>
      {c.followNote && <p className="changes-note" role="status">{c.followNote}</p>}
    </div>
  );
}
