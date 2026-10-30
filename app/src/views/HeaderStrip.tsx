import { memo, type ReactNode } from 'react';
import { Breadcrumb, type Crumb } from '../shell/Breadcrumb';
import { groupLabel, groupName, isGroup, parseGroupId } from '../graph/model';
import { treeParent } from '../graph/tree';
import { type RecordIndex } from '../exploring/record-summaries/record-index';
import { KindBadge } from '../specs/parts';
import { Link } from '../router';
import { addressOf } from './address';

// The header strip (LA-V96): one condensed line directly under the active tab, about 28 px, that
// names the focus whatever the stage: its trail up the tree (the one breadcrumb, collapsed past
// three places), then its kind, ID and title, and at the right what the stage draws of it ("9
// records · 8 links"). The title is cut with an ellipsis, its whole text in its tooltip and, being
// in the page, read in full by assistive technology. It is the page's h1. On the web, where the browser's tabs are the
// places and there is no tab row above it, it is the panel's one row and holds the page's controls at its right.

/** A place in the tree as a crumb: a record by its title, a group by its name, each with its whole name. */
export function crumbOf(index: RecordIndex, id: string): Crumb {
  const record = index.byId.get(id);
  if (record) return { to: addressOf(id), label: record.title, full: `${record.title} (${id})` };
  const name = groupName(index, id);
  return { to: addressOf(id), label: name, full: `${name} of ${parseGroupId(id)?.parent ?? id}` };
}

/** The places above a focus in the graph's tree, from its product down to its parent. */
export function focusTrail(index: RecordIndex, focus: string): Crumb[] {
  const out: Crumb[] = [];
  for (let at = treeParent(index, focus); at !== null; at = treeParent(index, at)) {
    if (index.byId.has(at) || isGroup(index, at)) out.unshift(crumbOf(index, at));
  }
  return out;
}

export interface HeaderStripProps {
  index: RecordIndex;
  focus: string;
  /** What the stage draws of the focus, one text: "9 records · 2 groups · 8 links". */
  counts: string;
  /** The page's controls (PageBar.tsx's PageActions), at the right, when there is no page bar above. */
  actions?: ReactNode;
}

export const HeaderStrip = memo(function HeaderStrip({ index, focus, counts, actions }: HeaderStripProps) {
  const record = index.byId.get(focus);
  const title = record?.title ?? (isGroup(index, focus) ? groupLabel(index, focus) : focus);
  const trail = focusTrail(index, focus);
  return (
    <div className={`header-strip${actions ? ' has-actions' : ''}`} data-floating="top">
      {trail.length > 0 && <Breadcrumb items={trail} className="header-strip-trail" />}
      {trail.length > 0 && <span className="header-strip-sep" aria-hidden="true">›</span>}
      {/* Keyed by the focus: a new focus is new text drawn in place, never the last one's slid along (UX-R08). */}
      <div key={focus} className="header-strip-focus" title={record ? `${record.title} (${focus})` : title}>
        {record && <KindBadge index={index} kind={record.kind} />}
        {record && <Link to={addressOf(focus)} className="header-strip-id record-link"><code>{focus}</code></Link>}
        <h1 className="header-strip-title">{title}</h1>
      </div>
      <span className="header-strip-counts" title={counts}>{counts}</span>
      {actions}
    </div>
  );
});
