import { type RecordIndex } from '../exploring/record-summaries/record-index';
import { type MetaStage } from '../platform/meta-model/reads';
import type { Stage } from '../../../lathe/src/platform/data/schema';
import type { KeyEntry } from '../views/StageChrome';
import { BOX_LOOKS, type BoxLook } from './paint';
import { BADGE_TONES } from './plate';
import { MARKS, SHAPES, nodeShape, type Mark, type Shape } from './shapes';
import { MarkIcon, ShapeIcon } from './shape-icons';
import { stageFor, type Neighborhood } from './model';
import { marksOf } from './text';

// The Graph stage's key (LA-V93-R12): the entries of the stage's key bar (views/StageChrome.tsx StageKey), one for each
// color, shape, mark, line and badge the graph draws around its focus, and nothing it does not: a kind the filters hide
// takes its color, shape and mark with it when nothing else drawn has them.

type Badge = (typeof BADGE_TONES)[number];

/** What the graph draws now, for its key. */
export interface GraphDrawn {
  looks: ReadonlySet<BoxLook>;
  shapes: ReadonlySet<Shape>;
  marks: ReadonlySet<Mark>;
  badges: ReadonlySet<Badge>;
  layout: 'tree' | 'nested' | 'map';
}

/** What each stage's color holds, in its tooltip. */
const STAGE_KINDS: Readonly<Record<Stage, string>> = {
  discovery: 'business outcome, journey, journey step',
  'domain-model': 'domain, aggregate, entity, value object, constraint, invariant, specification, domain event, command, read model, query, policy, domain service, term',
  'use-cases': 'capability, use case, UC requirement, pattern and its rules',
  'interaction-design': 'flow, flow step, view, view requirement, endpoint, API requirement, integration',
  'technical-specification': 'the technical record that implements each design record, a table, a UI component, a standard and its rules',
  'test-plan': 'every kind of test, and the test data sets tests start from',
};

/** A shape's word in the key: the kind it is first drawn for. */
const SHAPE_WORDS: Readonly<Record<Shape, string>> = {
  product: 'Product', hexagon: 'Domain', folder: 'Folder', double: 'Aggregate', box: 'Entity', octagon: 'Rule', flag: 'Event',
  parallelogram: 'Command', slice: 'Capability', stadium: 'Use case', page: 'Requirement', stack: 'Pattern', 'chevron-bar': 'Flow',
  chevron: 'Flow step', tab: 'Journey step', window: 'View', port: 'Endpoint', component: 'Technical', stripes: 'Table', shield: 'Test', diamond: 'Question',
};

/** A mark's word in the key: what it tells apart. */
const MARK_WORDS: Readonly<Record<Mark, string>> = {
  value: 'Value', gear: 'Logic', lens: 'Read', marker: 'Term', ruler: 'Standard', port: 'Integration', target: 'Outcome', data: 'Test data', plug: 'Interface', route: 'Journey',
};

const BADGES: Readonly<Record<Badge, { sample: string; words: string; meaning: string }>> = {
  error: { sample: '!', words: 'Errors', meaning: 'Has errors (on a group: among its members)' },
  warning: { sample: '!', words: 'Warnings', meaning: 'Has warnings (on a group: among its members)' },
  gap: { sample: 'gap', words: 'Gap', meaning: 'Not designed or not proved (on a group: among its members)' },
};

const stageName = (stages: readonly MetaStage[], stage: Stage) =>
  stages.find((s) => s.stage === stage)?.label ?? `${stage.charAt(0).toUpperCase()}${stage.slice(1).replaceAll('-', ' ')}`;

/** The look's words and meaning: a stage's color, the structural colors, a group's outline or an open question's. */
function lookEntry(look: BoxLook, stages: readonly MetaStage[]): Pick<KeyEntry, 'words' | 'meaning'> {
  if (look === 'stage-structural') return { words: 'Structural', meaning: 'Structural: the product and what has no stage' };
  if (look === 'stage-group') return { words: 'Group', meaning: 'A stage, folder or group, outlined in its stage\'s color (gray for open questions)' };
  if (look === 'kind-question') return { words: 'Open question', meaning: 'An open question, in the warning color (dashed in the Nested view)' };
  const stage = look.slice('stage-'.length) as Stage;
  const name = stageName(stages, stage);
  return { words: name, meaning: `${name}: ${STAGE_KINDS[stage]}` };
}

/** The Graph stage's key entries for what it draws: colors, the focus, shapes, marks, the layout's lines or boxes, then badges. */
export function graphKeyEntries(drawn: GraphDrawn, stages: readonly MetaStage[] = []): KeyEntry[] {
  const out: KeyEntry[] = [];
  for (const look of BOX_LOOKS) {
    if (drawn.looks.has(look)) out.push({ id: look, group: 'colors', sample: <span className={`graph-swatch ${look}`} />, ...lookEntry(look, stages) });
  }
  out.push({ id: 'focus', group: 'colors', sample: <span className="graph-swatch is-focus" />, words: 'Focus', meaning: 'The focus, ringed' });
  for (const shape of Object.keys(SHAPES) as Shape[]) {
    if (!drawn.shapes.has(shape)) continue;
    out.push({ id: `shape-${shape}`, group: 'shapes', sample: <span className={`graph-swatch is-shape shape-${shape}`}><ShapeIcon shape={shape} /></span>, words: SHAPE_WORDS[shape], meaning: `${SHAPES[shape].kinds}: ${SHAPES[shape].name}` });
  }
  for (const mark of Object.keys(MARKS) as Mark[]) {
    if (!drawn.marks.has(mark)) continue;
    out.push({ id: `mark-${mark}`, group: 'marks', sample: <span className={`graph-swatch is-shape mark-${mark}`}><MarkIcon mark={mark} /></span>, words: MARK_WORDS[mark], meaning: MARKS[mark] });
  }
  if (drawn.layout === 'tree') out.push({ id: 'line', group: 'lines', sample: <span className="graph-line" />, words: 'Parent line', meaning: 'Parent to child: the tree, through stages, folders and groups' });
  if (drawn.layout === 'nested') out.push({ id: 'nested', group: 'lines', sample: <span className="graph-swatch stage-nested" />, words: 'Box in box', meaning: 'Nested view: a box holding its children below its name, as big as the records under it' });
  if (drawn.layout === 'map') {
    out.push({ id: 'district', group: 'lines', sample: <span className="graph-swatch stage-district" />, words: 'District', meaning: 'Map: a domain (or what the product shares) as an area, its stages left to right in it, their folders one under another, each named with its count of records' });
    out.push({ id: 'composed', group: 'lines', sample: <span className="graph-swatch stage-nested" />, words: 'Part of', meaning: 'Map: a record inside another is part of it (an aggregate\'s entities, a journey\'s steps, a use case\'s requirements and flows, every record\'s tests); every leaf record is one size' });
    out.push({ id: 'then', group: 'lines', sample: <span className="graph-line is-link" />, words: 'Then', meaning: 'Map: inside a journey or a flow, an arrow from each step to the next on its path, the main path and each other one' });
    out.push({ id: 'link', group: 'lines', sample: <span className="graph-line is-link" />, words: 'Link', meaning: 'Map: the focus\'s and the selection\'s links as lines, named by their relation (All links, under Filters, draws every link in view)' });
  }
  if (drawn.layout !== 'map') out.push({ id: 'bar', group: 'lines', sample: <span className="graph-swatch stage-bar" />, words: 'Too small', meaning: 'A bar: children too small to draw at this zoom' });
  for (const badge of BADGE_TONES) {
    if (!drawn.badges.has(badge)) continue;
    const b = BADGES[badge];
    out.push({ id: `badge-${badge}`, group: 'badges', sample: <span className={`graph-mark ${badge}`}>{b.sample}</span>, words: b.words, meaning: b.meaning });
  }
  return out;
}

/**
 * What the graph draws around its focus, for its key: the picture the camera frames (the neighborhood, with the kind
 * filters applied), each node by its look, shape, mark and badges. The rest of the map is the same kinds further off, so
 * the key stays short and says what is in front of the Reader.
 */
export function graphDrawn(index: RecordIndex, graph: Neighborhood, layout: GraphDrawn['layout']): GraphDrawn {
  const looks = new Set<BoxLook>();
  const shapes = new Set<Shape>();
  const marks = new Set<Mark>();
  const badges = new Set<Badge>();
  for (const { id } of graph.nodes) {
    const record = index.byId.get(id);
    looks.add(!record ? 'stage-group' : record.kind === 'question' ? 'kind-question' : `stage-${stageFor(index, id, record.kind)}`);
    const { shape, mark } = nodeShape(index, id);
    shapes.add(shape);
    if (mark) marks.add(mark);
    const m = marksOf(index, id);
    if (m.errors > 0) badges.add('error');
    else if (m.warnings > 0) badges.add('warning');
    if (m.gaps.length > 0) badges.add('gap');
  }
  return { looks, shapes, marks, badges, layout };
}
