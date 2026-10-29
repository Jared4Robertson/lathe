import type { ReactNode, RefObject } from 'react';
import { Button } from '../components/Button';
import { Icon } from '../components/icons';
import { ErdIcon } from '../erd/ErdIcon';
import { Tooltip } from '../shell/Tooltip';
import type { SpecIndex } from '../specs/data';
import { STAGE_LABELS, STAGE_NAMES, type StageName } from './address';
import { crowdedLabel } from './openSpace';
import { TabStrip } from './TabStrip';
import type { TabsApi } from './usePlace';

// The page bar (LA-PAT-APP-UX-R03): the top of the tab panel, floating over the stage, as the top
// of VS Code's editor area. At its left the desktop app's tabs (none on the web, where the browser's tabs are the
// places); at its right the stage switch (Graph, ERD,
// Trace), a divider and the wiki card toggle. It is one line high whatever it
// holds (the tabs scroll sideways), so nothing below it moves (UX-R08). Every stage works on every
// focus (LA-PAT-APP-UX-R17): the switch always holds all three, never disabled or hidden.
//
// On a phone it is the same bar, compact (notes/mobile-design.md): in the desktop app the tabs fold into an "Open
// pages" button that opens them as a sheet, the stage switch is segments with names, the wiki
// button opens the card as a bottom sheet.

export const STAGE_COMMANDS: Record<StageName, string> = { graph: 'stageGraph', erd: 'stageErd', trace: 'stageTrace' };

export function StageIcon({ stage, size = 16 }: { stage: StageName; size?: number }) {
  return stage === 'erd' ? <ErdIcon size={size} /> : <Icon name={stage} size={size} />;
}

export interface PageBarProps {
  index: SpecIndex;
  /** The desktop app's tabs; null on the web. */
  tabs: TabsApi | null;
  /** The stage shown. */
  stage: StageName;
  onStage: (stage: StageName) => void;
  /** The phone's compact bar. */
  compact: boolean;
  cardShown: boolean;
  /** The wiki card is open by the Reader's choice but collapsed for space (LA-PAT-APP-UX-R18). */
  cardCrowded?: boolean;
  onCard: (show: boolean) => void;
  cardButton?: RefObject<HTMLButtonElement | null>;
  /** On a phone: whether the open pages sheet is shown, and its button. */
  pagesOpen?: boolean;
  onPages?: () => void;
  pagesButton?: RefObject<HTMLButtonElement | null>;
}

export function PageBar(props: PageBarProps) {
  const { index, tabs, stage, onStage, compact, cardShown, cardCrowded = false, onCard, cardButton, pagesOpen = false, onPages, pagesButton } = props;
  const count = tabs?.set.tabs.length ?? 0;
  // A panel collapsed for space says so on its toggle, which opens it anyway.
  const cardLabel = cardCrowded ? crowdedLabel('card') : `${cardShown ? 'Collapse' : 'Show'} the wiki card`;

  let start: ReactNode = null;
  if (!tabs) start = null;
  else if (compact) {
    start = (
      <button
        ref={pagesButton}
        type="button"
        className={`page-bar-pages${pagesOpen ? ' is-on' : ''}`}
        aria-label={`Open pages: ${count}`}
        aria-expanded={pagesOpen}
        aria-haspopup="dialog"
        onClick={onPages}
      >
        <Icon name="pages" size={18} />
        <span className="page-bar-count">{count}</span>
      </button>
    );
  } else {
    start = <TabStrip index={index} set={tabs.set} onActivate={tabs.activate} onClose={tabs.close} />;
  }

  return (
    <div className={`page-bar${compact ? ' is-compact' : ''}`} data-floating={compact ? undefined : 'top'}>
      <div className="page-bar-start">{start}</div>
      <div className="page-bar-actions">
        <div className={compact ? 'view-switch' : 'stage-switch'} role="group" aria-label="Stage">
          {STAGE_NAMES.map((s) => (
              <Tooltip key={s} label={`${STAGE_LABELS[s]} stage`} command={STAGE_COMMANDS[s]}>
                <button
                  type="button"
                  className={compact ? `view-segment${stage === s ? ' is-on' : ''}` : `icon-button${stage === s ? ' is-on' : ''}`}
                  aria-label={STAGE_LABELS[s]}
                  aria-pressed={stage === s}
                  data-command={STAGE_COMMANDS[s]}
                  onClick={() => onStage(s)}
                >
                  <StageIcon stage={s} size={compact ? 18 : 16} />
                  {compact && <span className="view-segment-label" aria-hidden="true">{STAGE_LABELS[s]}</span>}
                </button>
              </Tooltip>
          ))}
        </div>
        <span className="pane-divider" aria-hidden="true" />
        <Tooltip label={cardLabel} command="toggleWikiCard" placement="left">
          <Button
            variant="icon"
            ref={cardButton}
            className={`wiki-panel-toggle${cardShown ? ' is-on' : ''}${cardCrowded ? ' is-crowded' : ''}`}
            label={cardLabel}
            aria-expanded={cardShown}
            onClick={() => onCard(!cardShown)}
          >
            <Icon name="wiki" size={compact ? 20 : 16} />
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}
