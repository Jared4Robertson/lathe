import type { ReactNode, RefObject } from 'react';
import { Icon } from '../components/icons';
import { ModelIcon } from '../model/ModelIcon';
import { Tooltip } from '../shell/Tooltip';
import type { SpecIndex } from '../specs/data';
import { VIEW_LABELS, type ViewName } from './address';
import { TabStrip } from './TabStrip';
import type { PageTabsApi } from './useTabs';

// The page bar (LA-PAT-APP-CODE-R11): one strip across the top of the open panes, as the top of
// VS Code's editor area. A tab is a page and the panes are views of it, so the bar holds what is
// the page's: at its left the page's tabs, at its right the View group (Wiki, Graph, Model), a
// divider, and the inspector toggle at the far right, beside the inspector. It is one line high
// whatever it holds (the tabs scroll sideways), so nothing below it moves (R17).
//
// On a phone it is the same bar, compact (notes/mobile-design.md): the tabs fold into an "Open
// pages" button that opens them as a sheet, the View group shows one view at a time, and the
// inspector toggle opens the inspector as a bottom sheet. The shell's top bar above it names the page.

export const VIEW_COMMANDS: Record<ViewName, string> = { wiki: 'viewWiki', graph: 'viewGraph', model: 'viewModel' };

export function ViewIcon({ view, size = 16 }: { view: ViewName; size?: number }) {
  return view === 'model' ? <ModelIcon size={size} /> : <Icon name={view} size={size} />;
}

export interface PageBarProps {
  index: SpecIndex;
  tabs: PageTabsApi;
  /** The views this page offers, in order. */
  offered: readonly ViewName[];
  /** The views shown (one on a phone). */
  open: readonly ViewName[];
  onView: (view: ViewName) => void;
  /** The phone's compact bar. */
  compact: boolean;
  inspectorShown: boolean;
  onInspector: (show: boolean) => void;
  inspectorButton: RefObject<HTMLButtonElement | null>;
  /** The View toggles' elements, so focus can come back to the one just used. */
  toggles?: RefObject<Partial<Record<ViewName, HTMLButtonElement | null>>>;
  /** On a phone: whether the open pages sheet is shown, and its button. */
  pagesOpen?: boolean;
  onPages?: () => void;
  pagesButton?: RefObject<HTMLButtonElement | null>;
}

export function PageBar(props: PageBarProps) {
  const { index, tabs, offered, open, onView, compact, inspectorShown, onInspector, inspectorButton, toggles, pagesOpen = false, onPages, pagesButton } = props;
  const count = tabs.set.tabs.length;
  const inspectorLabel = `${inspectorShown ? 'Hide' : 'Show'} the inspector`;

  /** A view toggle's tooltip: what a click does, and that the last open view stays open. */
  const toggleLabel = (v: ViewName) =>
    !compact && open.length === 1 && open[0] === v ? `${VIEW_LABELS[v]} view (stays open: it is the only one)` : `${VIEW_LABELS[v]} view`;

  let start: ReactNode;
  if (compact) {
    start = (
      <button
        ref={pagesButton}
        type="button"
        className={`page-bar-pages${pagesOpen ? ' is-on' : ''}`}
        aria-label={`Open pages (${count})`}
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
    <div className={`page-bar${compact ? ' is-compact' : ' panel'}`}>
      <div className="page-bar-start">{start}</div>
      <div className="page-bar-actions">
        {offered.length > (compact ? 1 : 0) && (
          <div className={compact ? 'view-switch' : 'pane-views'} role="group" aria-label="View">
            {offered.map((v) => (
              <Tooltip key={v} label={toggleLabel(v)} command={VIEW_COMMANDS[v]}>
                <button
                  type="button"
                  ref={(el) => { if (toggles?.current) toggles.current[v] = el; }}
                  className={compact ? `view-segment${open.includes(v) ? ' is-on' : ''}` : `icon-button${open.includes(v) ? ' is-on' : ''}`}
                  aria-label={VIEW_LABELS[v]}
                  aria-pressed={open.includes(v)}
                  data-command={VIEW_COMMANDS[v]}
                  onClick={() => onView(v)}
                >
                  <ViewIcon view={v} size={compact ? 18 : 16} />
                  {compact && <span className="view-segment-label" aria-hidden="true">{VIEW_LABELS[v]}</span>}
                </button>
              </Tooltip>
            ))}
          </div>
        )}
        <span className="pane-divider" aria-hidden="true" />
        <Tooltip label={inspectorLabel} command="toggleInspector" placement="left">
          <button
            type="button"
            ref={inspectorButton}
            className={`icon-button inspector-toggle${inspectorShown ? ' is-on' : ''}`}
            aria-label={inspectorLabel}
            aria-expanded={inspectorShown}
            aria-controls="inspector"
            onClick={() => onInspector(!inspectorShown)}
          >
            <Icon name={compact ? 'info' : 'sidebar-right'} size={compact ? 20 : 16} />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
