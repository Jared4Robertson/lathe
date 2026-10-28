import type { ReactNode, RefObject } from 'react';
import { Button } from '../components/Button';
import { Icon } from '../components/icons';
import { ErdIcon } from '../erd/ErdIcon';
import { Tooltip } from '../shell/Tooltip';
import type { SpecIndex } from '../specs/data';
import { STAGE_LABELS, STAGE_NAMES, type StageName } from './address';
import { TabStrip } from './TabStrip';
import type { PageTabsApi } from './useTabs';

// The page bar (LA-PAT-APP-UX-R03): the top of the tab panel, floating over the stage, as the top
// of VS Code's editor area. At its left the page's tabs; at its right the stage switch (Graph, ERD,
// Trace), a divider, the wiki card toggle and the side bar toggle. It is one line high whatever it
// holds (the tabs scroll sideways), so nothing below it moves (UX-R08). The stage switch keeps a
// slot for every stage on every page, so its buttons never move under the pointer: a stage the
// page does not offer (ERD outside a domain, an aggregate or an entity; Trace where no obligation
// is) shows dimmed, and its tooltip says where it works.
//
// On a phone it is the same bar, compact (notes/mobile-design.md): the tabs fold into an "Open
// pages" button that opens them as a sheet, the stage switch shows the stages offered, the wiki
// button opens the card as a bottom sheet and the side bar toggle opens the side bar as a drawer.

export const STAGE_COMMANDS: Record<StageName, string> = { graph: 'stageGraph', erd: 'stageErd', trace: 'stageTrace' };

/** Where a stage works, for the dimmed slot of a stage a page does not offer. */
const NOT_OFFERED: Record<StageName, string> = {
  graph: 'on every page',
  erd: 'on a domain, an aggregate or an entity',
  trace: 'on a requirement or rule, or a page with one under it',
};

export function StageIcon({ stage, size = 16 }: { stage: StageName; size?: number }) {
  return stage === 'erd' ? <ErdIcon size={size} /> : <Icon name={stage} size={size} />;
}

export interface PageBarProps {
  index: SpecIndex;
  tabs: PageTabsApi;
  /** The stages this page offers, in order. */
  offered: readonly StageName[];
  /** The stage shown. */
  stage: StageName;
  onStage: (stage: StageName) => void;
  /** The phone's compact bar. */
  compact: boolean;
  cardShown: boolean;
  onCard: (show: boolean) => void;
  cardButton?: RefObject<HTMLButtonElement | null>;
  sideBarShown: boolean;
  onSideBar: (show: boolean) => void;
  sideBarButton: RefObject<HTMLButtonElement | null>;
  /** On a phone: whether the open pages sheet is shown, and its button. */
  pagesOpen?: boolean;
  onPages?: () => void;
  pagesButton?: RefObject<HTMLButtonElement | null>;
}

export function PageBar(props: PageBarProps) {
  const { index, tabs, offered, stage, onStage, compact, cardShown, onCard, cardButton, sideBarShown, onSideBar, sideBarButton, pagesOpen = false, onPages, pagesButton } = props;
  const count = tabs.set.tabs.length;
  const sideBarLabel = `${sideBarShown ? 'Hide' : 'Show'} the side bar`;
  const cardLabel = `${cardShown ? 'Collapse' : 'Show'} the wiki card`;

  /** On a wide screen every stage keeps its slot; on a phone the switch shows only the stages offered. */
  const slots: readonly StageName[] = compact ? offered : STAGE_NAMES;

  let start: ReactNode;
  if (compact) {
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
    start = <TabStrip index={index} set={tabs.set} onActivate={tabs.activate} onClose={tabs.close} onKeep={tabs.keep} />;
  }

  return (
    <div className={`page-bar${compact ? ' is-compact' : ''}`} data-floating={compact ? undefined : 'top'}>
      <div className="page-bar-start">{start}</div>
      <div className="page-bar-actions">
        {offered.length > (compact ? 1 : 0) && (
          <div className={compact ? 'view-switch' : 'stage-switch'} role="group" aria-label="Stage">
            {slots.map((s) => offered.includes(s) ? (
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
            ) : (
              <Tooltip key={s} label={`${STAGE_LABELS[s]} stage: ${NOT_OFFERED[s]}`}>
                <Button
                  variant="icon"
                  className="is-unavailable"
                  label={`${STAGE_LABELS[s]} (${NOT_OFFERED[s]})`}
                  aria-disabled="true"
                >
                  <StageIcon stage={s} size={16} />
                </Button>
              </Tooltip>
            ))}
          </div>
        )}
        <span className="pane-divider" aria-hidden="true" />
        <Tooltip label={cardLabel} command="toggleWikiCard" placement="left">
          <Button
            variant="icon"
            ref={cardButton}
            className={`wiki-card-toggle${cardShown ? ' is-on' : ''}`}
            label={cardLabel}
            aria-expanded={cardShown}
            onClick={() => onCard(!cardShown)}
          >
            <Icon name="wiki" size={compact ? 20 : 16} />
          </Button>
        </Tooltip>
        <Tooltip label={sideBarLabel} command="toggleSideBar" placement="left">
          <Button
            variant="icon"
            ref={sideBarButton}
            className={`side-bar-toggle${sideBarShown ? ' is-on' : ''}`}
            label={sideBarLabel}
            aria-expanded={sideBarShown}
            aria-controls="side-bar"
            onClick={() => onSideBar(!sideBarShown)}
          >
            <Icon name={compact ? 'info' : 'sidebar-right'} size={compact ? 20 : 16} />
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}
