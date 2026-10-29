import type { ReactNode } from 'react';
import { ChangesKey } from '../changes/ChangesKey';

// The Trace stage's key (LA-V98), in the stage toolbar's Key popover (views/StageChrome.tsx): what the tree's boxes,
// arrows and fades mean, why it shows what it shows for the focus (`lead`, the matrix's note), and how to move around.

export function TraceKey({ lead }: { lead?: ReactNode }) {
  return (
    <div className="trace-key">
      {lead}
      <ul className="plain">
        <li><span className="graph-swatch stage-use-cases" /> A record, in its stage&rsquo;s color: one tree from the product, its outcomes first, then each domain with the capabilities, aggregates, views and other parents of its obligations side by side; each obligation&rsquo;s chain runs on to the right</li>
        <li><span className="graph-swatch" /> A link under an outcome to a capability serving it; it focuses the capability in its domain</li>
        <li><span className="graph-swatch is-gap" /> A gap coverage reports, dashed: not designed, not built or not proved; Untraced, last under the product, dashed, holds the records no requirement or rule reaches</li>
        <li><span className="graph-line" /> An arrow for each actual link along a chain; plain lines join each parent to what hangs from it. A record several chains hold is drawn in each, noting in how many places</li>
        <li><span className="graph-swatch is-focus" /> The focus, ringed on every copy; what lies outside it is faded, and Gaps only fades the complete branches</li>
      </ul>
      <ChangesKey />
      <p className="hint">Click a box, or press Enter on it, to focus it. From anywhere on the page but a field, a list or a menu that uses them, the arrow keys (or W, A, S and D) walk the tree as on the Graph: Left out to the parent, Right in to the first child, Up and Down across; Enter on a link focuses its capability.</p>
    </div>
  );
}
