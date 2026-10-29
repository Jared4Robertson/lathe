import type { ReactNode } from 'react';
import { Icon } from '../components/icons';
import { Tooltip } from '../shell/Tooltip';
import type { Stage, StageRule } from '../specs/data';
import { MARKS, SHAPES, type Mark, type Shape } from './shapes';
import { MarkIcon, ShapeIcon } from './shape-icons';
import { ChangesKey } from '../changes/ChangesKey';

// Every stage's Key (LA-PAT-APP-UX-R21): a small Key button at the end of the stage toolbar
// (views/StageChrome.tsx) that opens the stage's key as a popover over the stage, as the Filters do.
// The Graph's key is here (LA-V93-R12): what each color, shape, mark and line means, and how to move
// around; the ERD's is erd/ErdView.tsx's ErdKey, the Trace's trace/TraceKey.tsx.

/** What each stage's swatch holds, in the key. */
const STAGE_KINDS: Readonly<Record<Stage, string>> = {
  discovery: 'business outcome',
  'domain-model': 'domain, aggregate, entity, value object, constraint, invariant, specification, domain event, command, read model, query, policy, domain service, term',
  'use-cases': 'capability, use case, UC requirement, pattern and its rules',
  'interaction-design': 'flow, flow step, view, view requirement, endpoint, API requirement, integration',
  'technical-specification': 'the technical record that implements each design record, a table, a UI component, a standard and its rules',
  'test-plan': 'every kind of test, and the test data sets tests start from',
};
const STAGE_NAMES = Object.keys(STAGE_KINDS) as Stage[];

/** The Key button and its popover, holding a stage's key, at the end of the stage toolbar. */
export function KeyControl({ children }: { children: ReactNode }) {
  return (
    <details className="stage-key">
      {/* In a narrow toolbar only the icon shows; the name stays the summary's text (LA-PAT-APP-UX-R08). */}
      <Tooltip label="Key">
        <summary><Icon name="info" size={14} /><span className="stage-key-name">Key</span></summary>
      </Tooltip>
      {/* The popover scrolls when long: a region that takes focus to scroll by the arrows (LA-V61-R46). */}
      <div className="stage-key-body" role="region" aria-label="Key" tabIndex={0}>{children}</div>
    </details>
  );
}

/** The graph's key: one swatch per stage, labeled by the stage's label from the schema (or its name in words), then the shapes, marks and lines. */
export function GraphKey({ stages = [] }: { stages?: readonly StageRule[] }) {
  const label = (stage: Stage) => stages.find((s) => s.stage === stage)?.label ?? `${stage.charAt(0).toUpperCase()}${stage.slice(1).replaceAll('-', ' ')}`;
  return (
    <div className="graph-legend">
      <ul className="plain">
        {STAGE_NAMES.map((stage) => (
          <li key={stage}><span className={`graph-swatch stage-${stage}`} /> {label(stage)} ({STAGE_KINDS[stage]})</li>
        ))}
        <li><span className="graph-swatch stage-structural" /> Structural (product)</li>
        <li><span className="graph-swatch kind-question" /> Open question, in the warning color (dashed in the Nested and Voronoi views)</li>
        <li><span className="graph-swatch stage-group" /> Groups: a stage, folder or group, a folder outlined in its stage's color (gray for open questions)</li>
        <li><span className="graph-swatch is-focus" /> The focus, ringed</li>
      </ul>
      <h4 className="graph-legend-heading">Shapes</h4>
      <ul className="plain">
        {(Object.keys(SHAPES) as Shape[]).map((shape) => (
          <li key={shape}><span className={`graph-swatch is-shape shape-${shape}`}><ShapeIcon shape={shape} /></span> {SHAPES[shape].kinds}: {SHAPES[shape].name}</li>
        ))}
        {(Object.keys(MARKS) as Mark[]).map((mark) => (
          <li key={mark}><span className={`graph-swatch is-shape mark-${mark}`}><MarkIcon mark={mark} /></span> {MARKS[mark]}</li>
        ))}
      </ul>
      <p className="hint">In the Tree view each box's outline is its kind's shape. In the Nested and Voronoi views every box keeps its rectangle or cell, and its shape is the small mark before its kind and ID.</p>
      <ul className="plain">
        <li><span className="graph-swatch stage-nested" /> Nested view: a box holding its children below its name</li>
        <li><span className="graph-swatch is-cell" /> Voronoi view: a cell made of its children's cells, its name at its top</li>
        <li><span className="graph-swatch stage-bar" /> A bar: children too small to draw at this zoom</li>
        <li><span className="graph-line" /> parent / child (the tree, through stages, folders and groups)</li>
        <li><span className="graph-mark error">!</span> has errors <span className="graph-mark warning">!</span> has warnings <span className="graph-mark gap">gap</span> not designed or not proved (on a group: among its members)</li>
      </ul>
      <ChangesKey />
      <p className="hint">The graph is one map of the nav's tree: a product holds its own stages and its domains, a domain its five stages, each stage a folder per kind, each folder the records that start a branch of the stage, and each record what sits under it in the same stage. Levels run left to right, each parent as tall as its children, and nothing changes size: focusing moves the camera. Depth is how many levels below the focus the camera frames, folders included. A record's links to records in other branches are the Trace view's, which draws an obligation's chain from what designs it to the tests that prove it, and the wiki card's, which lists every link.</p>
      <p className="hint">The Nested layout (v) draws the same tree as boxes inside boxes: the product made of its stages and domains, each domain of its stages, each stage of its folders, each box as big as the records under it. Focusing frames the box; depth is how many levels inside it are labeled, and zooming in labels the rest.</p>
      <p className="hint">The Voronoi layout draws the same tree as polygon cells inside cells: the product a hexagon split into its stages and domains, each domain split into its stages, and so on down, each cell as big as the records under it and never too small for its name. It frames and labels as the Nested layout does.</p>
      <p className="hint">Click a record or a group, or press Enter on it, to focus it; Enter on the focus, or anywhere but a button, link or field, shows or collapses the wiki card, and Escape collapses it. Scroll, pinch or drag to look around. From anywhere on the page but a field, a list or a menu that uses them, the arrow keys, or W, A, S and D as Up, Left, Down and Right, step through the tree, each step moving the focus. In the Tree view, Left goes to the parent, Right to the first child, and Up and Down to the previous and next sibling; in the Nested and Voronoi views, which draw children inside their parent, Up goes to the parent, Down to the first child, and Left and Right to the previous and next sibling. Past the last sibling a step goes on to the first child of the next parent at that level, so repeated steps visit the whole level. In every view Shift+Up (or Shift+W) goes out to the parent and Shift+Down (or Shift+S) in to the first child, as the toolbar's Out and In do. Tab and Shift+Tab move between the boxes; + and - change the depth, and . frames the focus again.</p>
    </div>
  );
}
