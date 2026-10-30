import { createPortal } from 'react-dom';
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '../components/Button';
import { Icon } from '../components/icons';
import { useKeymap, useRunCommand, useRunWalk } from '../shell/commands';
import { WALK_COMMANDS, walkLetter } from '../shell/keymap';
import { Tooltip } from '../shell/Tooltip';
import { BottomSheet } from '../shell/BottomSheet';
import { useNarrow } from '../shell/useNarrow';
import { MOVES, type Move } from './levels';
import { ChangesTools } from '../changes/ChangesTools';

// One stage chrome (LA-PAT-APP-UX-R21): every stage (Graph, ERD, Trace) has the same controls in the same places, built
// from these three components, so no stage can drift.
// - StageToolbar floats at the top of the open space, centered on the stage while it fits there: first the shared
//   controls in a fixed order (the step buttons Left, Right, Up and Down, each showing its letter, then Out and In
//   between the levels, then Frame), then the Changes controls every stage shares (changes/ChangesTools.tsx), then the
//   stage's own. Each step runs the stage's walk (views/levels.ts) through the commands layer, as
//   its keys do. It is one row at every width (LA-PAT-APP-UX-R08): while it does not fit it steps down a tier before
//   paint (TOOLBAR_FORMS), and the walk, Frame and the stage's primary controls are the last to give way.
// - StageCamera sits in the bottom left corner of the frame: zoom in, zoom out and fit the whole map, the same buttons,
//   look and tooltips on every stage. A minimap (the Graph's) sits in the bottom right corner and the edge hints (the
//   ERD's) at the frame's edges, in their shared styles.
// - StageKey is the stage's key, a bar along the bottom of the open space on the camera's row, between the camera and
//   the minimap: each thing the stage draws now (a color, a shape, a line, a mark) as a small sample and a word or two,
//   its whole meaning in its tooltip. Each stage gives its own entries (graph/key.tsx, erd/erdKey.tsx,
//   trace/TraceKey.tsx, and changes/ChangesKey.tsx's live marks on every stage). On a phone it is a Key chip that opens
//   it as a sheet.

/** The toolbar's groups: the walk's steps (with Out and In), Frame, the Changes controls, and the stage's primary and secondary controls. */
type ToolbarGroup = 'steps' | 'frame' | 'changes' | 'primary' | 'secondary';

/** The toolbar's forms, widest first. */
export const TOOLBAR_TIERS = ['full', 'compact', 'changes', 'secondary', 'narrow', 'menu'] as const;
type ToolbarTier = (typeof TOOLBAR_TIERS)[number];

interface ToolbarForm {
  /** Names beside the icons (Frame, the Graph's Filters and Depth); without them the icons stand alone. */
  names: boolean;
  /** The Changes baseline picker in the row (it is always in the More menu and the Changes panel). */
  picker: boolean;
  /** Each step button's letter. */
  letters: boolean;
  /** The stage's narrow form of its own controls (the Graph's layouts by their first letter). */
  narrow: boolean;
  /** The groups folded into the More menu, in its order. */
  folded: readonly ToolbarGroup[];
}

/**
 * What each tier changes, in the fold order: the names and the baseline picker give way first, then the Changes group
 * folds into More, then the stage's secondary controls, then the step letters drop and the stage's own
 * controls narrow. The walk (the steps, Out and In), Frame and the stage's primary controls stay in the row on every
 * desktop width; only the last tier, for a phone, folds the steps too.
 */
export const TOOLBAR_FORMS: Readonly<Record<ToolbarTier, ToolbarForm>> = {
  full: { names: true, picker: true, letters: true, narrow: false, folded: [] },
  compact: { names: false, picker: false, letters: true, narrow: false, folded: [] },
  changes: { names: false, picker: false, letters: true, narrow: false, folded: ['changes'] },
  secondary: { names: false, picker: false, letters: true, narrow: false, folded: ['changes', 'secondary'] },
  narrow: { names: false, picker: false, letters: false, narrow: true, folded: ['changes', 'secondary'] },
  menu: { names: false, picker: false, letters: false, narrow: true, folded: ['steps', 'changes', 'secondary'] },
};

/** The mark each step button shows; beside it, the plain letter that takes the same step as the person bound it (A for Left by default). */
const STEP_MARKS: Readonly<Record<Move, string>> = { left: '←', right: '→', up: '↑', down: '↓', out: 'Out', in: 'In' };
const ARROW_MOVES: readonly Move[] = ['left', 'right', 'up', 'down'];

export interface StageToolbarProps {
  /** Whether a move goes anywhere from the focus: a step that goes nowhere is shown disabled. */
  can: (move: Move) => boolean;
  /** What a move does on this stage, when it says more than the keymap's title ("Step out to the parent"). */
  walkLabels?: Partial<Record<Move, string>>;
  /** The stage's own controls, in their narrow form or not: the primary ones always in the row, the secondary ones folding into More. */
  own?: (narrow: boolean) => { primary?: ReactNode; secondary?: ReactNode };
  /** Changes when the stage's own controls change width (a filter count shown), so the toolbar finds its tier again. */
  measureKey?: string | number;
}

export function StageToolbar({ can, walkLabels = {}, own, measureKey }: StageToolbarProps) {
  const runWalk = useRunWalk();
  const keymap = useKeymap();
  const titleOf = (move: Move) => keymap.commands.find((c) => c.id === WALK_COMMANDS[move])!.title;
  const runCommand = useRunCommand();
  const room = useRef<HTMLDivElement>(null);
  const toolbar = useRef<HTMLDivElement>(null);
  const [tier, setTier] = useState(0);
  const [, setWidth] = useState(0);
  // What the row needed at each wider tier it left, so more room goes straight back to the widest tier that fits.
  const needs = useRef<number[]>([]);
  useLayoutEffect(() => { needs.current = []; setTier(0); }, [measureKey]);
  useLayoutEffect(() => {
    const el = toolbar.current;
    if (!el || tier >= TOOLBAR_TIERS.length - 1 || el.scrollWidth <= el.clientWidth + 1) return;
    needs.current[tier] = el.scrollWidth;
    setTier(tier + 1);
  });
  // The room is the open space's width at the top (right of the nav, left of the chat), not the toolbar's own width, so
  // the toolbar widens again when the window grows or a panel collapses.
  useEffect(() => {
    const box = room.current;
    const el = toolbar.current;
    if (!box || !el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      const tools = el.parentElement!;
      const style = getComputedStyle(tools);
      const width = box.clientWidth - (tools.offsetWidth - tools.clientWidth) - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      setTier((t) => { const fits = needs.current.findIndex((n, i) => i < t && n <= width + 1); return fits < 0 ? t : fits; });
      setWidth(width);
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  const name = TOOLBAR_TIERS[tier];
  const form = TOOLBAR_FORMS[name];
  const folds = (group: ToolbarGroup) => form.folded.includes(group);
  const mine = own?.(form.narrow) ?? {};
  const steps = (
    <div className="stage-steps" role="group" aria-label="Walk the stage">
      {MOVES.map((move) => {
        const label = walkLabels[move] ?? titleOf(move);
        const mark = STEP_MARKS[move];
        const letter = ARROW_MOVES.includes(move) ? walkLetter(move, keymap.commands, keymap.mac) : '';
        return (
          <Tooltip key={move} label={label} command={WALK_COMMANDS[move]}>
            <Button className={`stage-step is-${move}`} aria-label={label} disabled={!can(move)} onClick={() => runWalk(move)}>
              {mark}{letter && form.letters && <span className="stage-step-letter" aria-hidden="true">{letter}</span>}
            </Button>
          </Tooltip>
        );
      })}
    </div>
  );
  const groups: Partial<Record<ToolbarGroup, ReactNode>> = { steps, changes: <ChangesTools picker />, secondary: mine.secondary };
  // A group with nothing in it (the ERD and the Trace have no secondary controls) takes no place in More.
  const inMore = form.folded.filter((g) => groups[g]);
  return (
    <div className="stage-tools-room" ref={room}>
      <div className="stage-tools" data-stage-tools="top">
        <div className="stage-toolbar" ref={toolbar} data-tier={name} data-names={form.names ? undefined : 'hidden'}>
          {!folds('steps') && steps}
          <Tooltip label="Frame the focus" command="graphFit">
            <Button className="stage-frame" aria-label="Frame the focus" onClick={() => runCommand('graphFit')}>
              <Icon name="focus" size={14} /><span className="stage-frame-name">Frame</span>
            </Button>
          </Tooltip>
          {!folds('changes') && <ChangesTools picker={form.picker} />}
          {mine.primary}
          {!folds('secondary') && mine.secondary}
          <div className="stage-toolbar-end">
            {inMore.length > 0 && (
              <details className="stage-more">
                <Tooltip label="More controls">
                  <summary aria-label="More controls"><Icon name="dots" size={16} /></summary>
                </Tooltip>
                <div className="stage-more-body">{inMore.map((g) => <Fragment key={g}>{groups[g]}</Fragment>)}</div>
              </details>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export interface StageCameraProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  /** Fits the whole map in the frame. */
  onFit: () => void;
}

/** The camera's buttons in the bottom left corner of the frame, the same on every stage. */
export function StageCamera({ onZoomIn, onZoomOut, onFit }: StageCameraProps) {
  return (
    <div className="stage-camera" role="group" aria-label="Camera">
      <Tooltip label="Zoom in"><Button variant="icon" className="stage-zoom-in" label="Zoom in" onClick={onZoomIn}><Icon name="plus" size={14} /></Button></Tooltip>
      <Tooltip label="Zoom out"><Button variant="icon" className="stage-zoom-out" label="Zoom out" onClick={onZoomOut}><Icon name="minus" size={14} /></Button></Tooltip>
      <Tooltip label="Fit the whole map"><Button variant="icon" className="stage-fit" label="Fit the whole map" onClick={onFit}><Icon name="maximize" size={14} /></Button></Tooltip>
    </div>
  );
}

/** One entry of a stage's key: a small sample of something the stage draws, a word or two for it, and its whole meaning. */
export interface KeyEntry {
  /** Unique in the key: what it stands for ("stage-domain-model", "shape-hexagon"). */
  id: string;
  /** The entries of one group sit together, a thin rule before each new group: colors, shapes, lines, marks, changes. */
  group: string;
  /** A tiny sample, as the stage draws it (a swatch, a shape, a line). */
  sample: ReactNode;
  /** One or two words: "Aggregate", "Raises", "Gap". */
  words: string;
  /** What it means in a sentence: the entry's tooltip, and its line in the phone's sheet. */
  meaning: string;
}

/**
 * The stage's key (LA-V96-R30): a frosted bar along the bottom of the open space, centered between the camera and the
 * minimap, holding only what the stage draws now. It counts as a floating panel at the bottom (`data-floating`), so the
 * camera frames above it. Too long for one row it wraps to as many rows as it needs, every entry whole, never cut or
 * scrolled out of sight; it takes focus as one named region, which never walks the stage. On a phone it is a Key chip
 * that opens the entries, with their meanings, as a sheet.
 */
export function StageKey({ entries, beside }: { entries: readonly KeyEntry[]; beside?: 'minimap' }) {
  const phone = useNarrow();
  if (entries.length === 0) return null;
  return phone ? <KeyChip entries={entries} /> : <KeyBar entries={entries} beside={beside} />;
}

/** `beside`: a minimap in the bottom right corner, which the bar keeps clear of. */
function KeyBar({ entries, beside }: { entries: readonly KeyEntry[]; beside?: 'minimap' }) {
  return (
    <div className="stage-key-room" data-beside={beside}>
      <section className="stage-key" role="region" aria-label="Key" tabIndex={0} data-floating="bottom">
        <ul className="stage-key-list">
          <KeyItems entries={entries} />
        </ul>
      </section>
    </div>
  );
}

function KeyItems({ entries, meanings = false }: { entries: readonly KeyEntry[]; meanings?: boolean }) {
  return entries.map((e, i) => (
    <li key={e.id} className="stage-key-entry" data-key-entry={e.id} data-group-start={i > 0 && entries[i - 1].group !== e.group ? '' : undefined} title={meanings ? undefined : e.meaning}>
      <span className="stage-key-sample" aria-hidden="true">{e.sample}</span>
      <span className="stage-key-words">{e.words}</span>
      {meanings && <span className="stage-key-meaning">{e.meaning}</span>}
    </li>
  ));
}

/** The phone's key: a chip at the foot of the stage that opens the entries as a sheet, each with its meaning. */
function KeyChip({ entries }: { entries: readonly KeyEntry[] }) {
  const [open, setOpen] = useState(false);
  const chip = useRef<HTMLButtonElement>(null);
  const close = () => { setOpen(false); setTimeout(() => chip.current?.focus(), 0); };
  // The sheet takes focus as it opens, on its close button; closing it gives focus back to the chip.
  useEffect(() => { if (open) document.querySelector<HTMLElement>('.stage-key-sheet .sheet-head button')?.focus(); }, [open]);
  return (
    <>
      <Button ref={chip} className="stage-key-chip" icon="info" data-floating="bottom" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>Key</Button>
      {open && createPortal(
        <BottomSheet label="Key" className="stage-key-sheet" onClose={close}>
          <div className="sheet-head">
            <h2 className="sheet-title">Key</h2>
            <Button variant="icon" label="Close the key" onClick={close}><Icon name="x" /></Button>
          </div>
          <ul className="stage-key-sheet-list" aria-label="Key">
            <KeyItems entries={entries} meanings />
          </ul>
        </BottomSheet>,
        document.body,
      )}
    </>
  );
}

/** How much one step of the zoom buttons zooms, on every stage. */
export const ZOOM_STEP = 1.2;
