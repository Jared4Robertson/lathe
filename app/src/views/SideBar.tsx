import { forwardRef, useEffect, type RefObject } from 'react';
import { Button } from '../components/Button';
import { Icon } from '../components/icons';
import { isGroup } from '../graph/model';
import type { GraphInfo } from '../graph/panel';
import { recordIdAt } from '../shell/desktopRecord';
import { Tooltip } from '../shell/Tooltip';
import type { SpecIndex } from '../specs/data';
import { SideBarDetails } from './SideBarDetails';
import { SideBarHistory } from './SideBarHistory';
import { SideBarOutline } from './SideBarOutline';
import { SIDE_VIEW_ICONS, SIDE_VIEW_LABELS, SIDE_VIEWS, usePeek, type PeekStore, type SideMode, type SideView } from './sideBarState';
import './SideBar.css';

// The side bar (LA-EXP-UC12), the page's last column, as VS Code's secondary side bar: one panel
// with a small switcher of three views at its top, Details, Outline and History, each earning its
// place by showing what the main view does not. It has its toggle, shortcut and width handle;
// whether it is open, and which view it shows, is kept per view mode and per tab
// (sideBar.ts). On a phone it is the same panel in a bottom sheet.

export interface SideBarProps {
  index: SpecIndex;
  /** The page's record, or a group's ID in the graph's tree. */
  focus: string;
  mode: SideMode;
  view: SideView;
  onView: (view: SideView) => void;
  /** What the graph draws, while a graph pane is shown. */
  graph: GraphInfo | null;
  /** The node under the pointer or selected, in a canvas or the wiki. */
  peek: PeekStore;
  /** The wiki pane's scroll box, for the outline and the selected row. */
  wikiPane: RefObject<HTMLDivElement | null>;
  /** Whether the wiki pane is open, so the side bar listens to the one drawn. */
  wikiOpen: boolean;
  onNavigate: (id: string) => void;
  hrefFor: (id: string) => string;
  onClose: () => void;
  /** In a bottom sheet on a phone. */
  drawer?: boolean;
}

/** A record or group the side bar can describe. */
const known = (index: SpecIndex, id: string | null): id is string => !!id && (index.byId.has(id) || isGroup(index, id));

export const SideBar = forwardRef<HTMLElement, SideBarProps>(function SideBar(props, ref) {
  const { index, focus, mode, view, onView, graph, peek, wikiPane, wikiOpen, onNavigate, hrefFor, onClose, drawer } = props;
  useWikiSelection(wikiPane, peek, index, wikiOpen);
  const { hover, selected } = usePeek(peek);
  const canvas = mode !== 'wiki';
  // Details: the hovered node (graph and model), else the selected one, else the page's own.
  // The center under the pointer is the page's own record: shown as the page's, so a click that re-centers changes nothing here.
  const hovered = canvas && hover !== focus && known(index, hover) ? hover : null;
  const chosen = known(index, selected) ? selected : null;
  const target = hovered ?? chosen ?? focus;
  const how = hovered ? 'hover' : chosen ? 'selected' : 'page';
  // History follows the selection, not the pointer, so a hover never asks git for a file.
  const historyOf = chosen ?? focus;

  return (
    <aside ref={ref} id="side-bar" className={`side-bar record-side${drawer ? ' is-drawer' : ''}`} aria-label="Side bar" tabIndex={-1} data-side-view={view} data-side-mode={mode}>
      <div className="side-bar-head">
        <div className="side-switch" role="group" aria-label="Side bar views">
          {SIDE_VIEWS.map((v) => (
            <Tooltip key={v} label={SIDE_VIEW_LABELS[v]}>
              <Button variant="icon" label={SIDE_VIEW_LABELS[v]} aria-pressed={view === v} aria-controls="side-view" className={view === v ? 'is-on' : undefined} onClick={() => onView(v)}>
                <Icon name={SIDE_VIEW_ICONS[v]} size={16} />
              </Button>
            </Tooltip>
          ))}
        </div>
        <Tooltip label="Hide the side bar" command="toggleSideBar" placement="left">
          <Button variant="icon" onClick={onClose} label="Hide the side bar">
            <Icon name={drawer ? 'x' : 'sidebar-right'} />
          </Button>
        </Tooltip>
      </div>
      <section id="side-view" className={`side-view side-${view}`} aria-labelledby="side-view-title">
        <h2 id="side-view-title" className="side-bar-title" tabIndex={-1}>{SIDE_VIEW_LABELS[view]}</h2>
        {/* Keyed by what it describes: a new node's details are new content drawn in place, never the last one's rows pushed along (UX-R08). */}
        {view === 'details' && <SideBarDetails key={`${focus} ${target} ${how}`} index={index} focus={focus} target={target} mode={mode} how={how} graph={graph} onNavigate={onNavigate} hrefFor={hrefFor} />}
        {view === 'outline' && <SideBarOutline index={index} focus={focus} mode={mode} graph={graph} wikiPane={wikiPane} onNavigate={onNavigate} hrefFor={hrefFor} />}
        {view === 'history' && <SideBarHistory index={index} id={index.byId.has(historyOf) ? historyOf : null} />}
      </section>
    </aside>
  );
});

/**
 * The wiki's selected row: a record row whose link has keyboard focus, or that was right-clicked
 * (held until a click elsewhere in the wiki or Escape). It is told to the side bar as `selected`.
 */
function useWikiSelection(wikiPane: RefObject<HTMLDivElement | null>, peek: PeekStore, index: SpecIndex, wikiOpen: boolean) {
  useEffect(() => {
    const pane = wikiPane.current;
    if (!pane) return;
    let pinned: string | null = null;
    const rowOf = (target: EventTarget | null) => {
      const link = target instanceof Element ? target.closest('a.row-link') : null;
      return link ? recordIdAt(link, window.location.pathname, (id) => index.byId.has(id)) : null;
    };
    const onFocusIn = (e: FocusEvent) => { const id = rowOf(e.target); if (id) peek.set('selected', id); };
    const onFocusOut = (e: FocusEvent) => { if (!rowOf(e.relatedTarget)) peek.set('selected', pinned); };
    const onMenu = (e: MouseEvent) => { const id = rowOf(e.target); if (id) { pinned = id; peek.set('selected', id); } };
    const onPointer = (e: PointerEvent) => {
      if (e.button !== 0 || !pinned) return;
      if (rowOf(e.target) === pinned) return;
      pinned = null;
      peek.set('selected', null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && pinned) { pinned = null; peek.set('selected', rowOf(document.activeElement)); } };
    pane.addEventListener('focusin', onFocusIn);
    pane.addEventListener('focusout', onFocusOut);
    pane.addEventListener('contextmenu', onMenu);
    pane.addEventListener('pointerdown', onPointer);
    pane.addEventListener('keydown', onKey);
    return () => {
      pane.removeEventListener('focusin', onFocusIn);
      pane.removeEventListener('focusout', onFocusOut);
      pane.removeEventListener('contextmenu', onMenu);
      pane.removeEventListener('pointerdown', onPointer);
      pane.removeEventListener('keydown', onKey);
    };
  }, [wikiPane, peek, index, wikiOpen]);
}
