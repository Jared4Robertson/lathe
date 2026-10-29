import type { ReactNode } from 'react';

// The Trace stage's key (LA-V98), in the stage toolbar's Key popover (views/StageChrome.tsx): what the map's boxes,
// arrows and fades mean, why it shows what it shows for the focus (`lead`, the matrix's note), and how to move around.

export function TraceKey({ lead }: { lead?: ReactNode }) {
  return (
    <div className="trace-key">
      {lead}
      <ul className="plain">
        <li><span className="graph-swatch stage-use-cases" /> A record, in its stage's color: on the left the why tree (an outcome, the capabilities serving it, their use cases or an obligation's own parent), then one lane per obligation, its chain left to right</li>
        <li><span className="graph-swatch is-gap" /> A gap coverage reports, dashed: not designed, not built or not proved</li>
        <li><span className="graph-line" /> An arrow for each actual link along the chain; the why tree's plain lines join each parent to what hangs from it</li>
        <li><span className="graph-swatch" /> &ldquo;+N more&rdquo;: a column holding more than it shows; it opens the lane in place</li>
        <li><span className="graph-swatch stage-group" /> The Untraced lane at the bottom: records no requirement or rule reaches</li>
        <li><span className="graph-swatch is-focus" /> The focus, ringed on every lane that holds it; what lies outside it is faded, and Gaps only fades the complete lanes</li>
      </ul>
      <p className="hint">Click a box, or press Enter on it, to focus it. From anywhere on the page but a field, a list or a menu that uses them, the arrow keys (or W, A, S and D) walk the map: Right along the lane, Left back and into the why tree, Up and Down in the column; Shift+Up (Shift+W) goes out to the lane and its band, Shift+Down (Shift+S) in to the first box inside, a &ldquo;+N more&rdquo; opening at the first box it hides.</p>
    </div>
  );
}
