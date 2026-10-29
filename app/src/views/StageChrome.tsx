import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '../components/Button';
import { Icon } from '../components/icons';
import { useRunCommand, useRunWalk } from '../shell/commands';
import { COMMANDS, WALK_COMMANDS } from '../shell/keymap';
import { Tooltip } from '../shell/Tooltip';
import { KeyControl } from '../graph/key';
import { MOVES, type Move } from './levels';
import { ChangesTools } from '../changes/ChangesTools';

// One stage chrome (LA-PAT-APP-UX-R21): every stage (Graph, ERD, Trace) has the same controls in the same places, built
// from these two components, so no stage can drift.
// - StageToolbar floats at the top of the open space, centered on the stage: first the shared controls in a fixed order
//   (the step buttons Left, Right, Up and Down, each showing its letter, then Out and In between the levels, then Frame),
//   then the Changes controls every stage shares (changes/ChangesTools.tsx), then the stage's own, then its Key popover. Each step runs the stage's walk (views/levels.ts) through the commands
//   layer, as its keys do. It is one row at every width (LA-PAT-APP-UX-R08): while it does not fit it steps down a tier
//   before paint, names hidden behind icons, then the stage's narrow form, then the steps and the stage's foldable
//   controls in a More menu.
// - StageCamera sits in the bottom left corner of the frame: zoom in, zoom out and fit the whole map, the same buttons,
//   look and tooltips on every stage. A minimap (the Graph's) sits in the bottom right corner and the edge hints (the
//   ERD's) at the frame's edges, in their shared styles.

/** The toolbar's forms, widest first. */
export const TOOLBAR_TIERS = ['full', 'compact', 'narrow', 'menu'] as const;
export type ToolbarTier = (typeof TOOLBAR_TIERS)[number];

/** The arrow each step button shows, and the letter that takes the same step. */
const STEP_MARKS: Readonly<Record<Move, { mark: string; letter: string }>> = {
  left: { mark: '←', letter: 'A' }, right: { mark: '→', letter: 'D' }, up: { mark: '↑', letter: 'W' }, down: { mark: '↓', letter: 'S' }, out: { mark: 'Out', letter: '' }, in: { mark: 'In', letter: '' },
};
const titleOf = (move: Move) => COMMANDS.find((c) => c.id === WALK_COMMANDS[move])!.title;

export interface StageToolbarProps {
  /** Whether a move goes anywhere from the focus: a step that goes nowhere is shown disabled. */
  can: (move: Move) => boolean;
  /** What a move does on this stage, when it says more than the keymap's title ("Step out to the parent"). */
  walkLabels?: Partial<Record<Move, string>>;
  /** The stage's own controls at a tier: those always shown, and those the narrowest tier folds into the More menu. */
  own?: (tier: ToolbarTier) => { controls?: ReactNode; fold?: ReactNode };
  /** The stage's key, in the Key popover. */
  stageKey: ReactNode;
  /** Changes when the stage's own controls change width (a filter count shown), so the toolbar finds its tier again. */
  measureKey?: string | number;
}

export function StageToolbar({ can, walkLabels = {}, own, stageKey, measureKey }: StageToolbarProps) {
  const runWalk = useRunWalk();
  const runCommand = useRunCommand();
  const toolbar = useRef<HTMLDivElement>(null);
  const [tier, setTier] = useState(0);
  const [, setRoom] = useState(0);
  const needs = useRef<number[]>([]);
  useLayoutEffect(() => { needs.current = []; setTier(0); }, [measureKey]);
  useLayoutEffect(() => {
    const el = toolbar.current;
    if (!el || tier >= TOOLBAR_TIERS.length - 1 || el.scrollWidth <= el.clientWidth + 1) return;
    needs.current[tier] = el.scrollWidth;
    setTier(tier + 1);
  });
  useEffect(() => {
    const el = toolbar.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      const room = el.clientWidth;
      setTier((t) => { const fits = needs.current.findIndex((n, i) => i < t && n <= room + 1); return fits < 0 ? t : fits; });
      setRoom(room);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const name = TOOLBAR_TIERS[tier];
  const mine = own?.(name) ?? {};
  const steps = (
    <div className="stage-steps" role="group" aria-label="Walk the stage">
      {MOVES.map((move) => {
        const label = walkLabels[move] ?? titleOf(move);
        const { mark, letter } = STEP_MARKS[move];
        return (
          <Tooltip key={move} label={label} command={WALK_COMMANDS[move]}>
            <Button className={`stage-step is-${move}`} aria-label={label} disabled={!can(move)} onClick={() => runWalk(move)}>
              {mark}{letter && <span className="stage-step-letter" aria-hidden="true">{letter}</span>}
            </Button>
          </Tooltip>
        );
      })}
    </div>
  );
  const folded = name === 'menu';
  return (
    <div className="stage-tools" data-stage-tools="top">
      <div className="stage-toolbar" ref={toolbar} data-tier={name}>
        {folded ? (
          <details className="stage-more">
            <Tooltip label="The steps, and more">
              <summary aria-label="More: the steps and more"><Icon name="dots" size={16} /></summary>
            </Tooltip>
            <div className="stage-more-body">{steps}<ChangesTools picker />{mine.fold}</div>
          </details>
        ) : steps}
        <Tooltip label="Frame the focus" command="graphFit">
          <Button className="stage-frame" aria-label="Frame the focus" onClick={() => runCommand('graphFit')}>
            <Icon name="focus" size={14} /><span className="stage-frame-name">Frame</span>
          </Button>
        </Tooltip>
        {!folded && <ChangesTools picker={name === 'full'} />}
        {mine.controls}
        {!folded && mine.fold}
        <div className="stage-toolbar-end">
          <KeyControl>{stageKey}</KeyControl>
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

/** How much one step of the zoom buttons zooms, on every stage. */
export const ZOOM_STEP = 1.2;
