import { useEffect, useRef, type KeyboardEvent, type MouseEvent, type WheelEvent } from 'react';
import { Icon } from '../components/icons';
import { groupLabel, isGroup } from '../graph/model';
import { Tooltip } from '../shell/Tooltip';
import { parseSpecRoute } from './spec-route';
import { type RecordIndex } from '../exploring/record-summaries/record-index';
import { focusOf, isFocusRoute } from './address';
import { hereOf } from './place';
import type { Tab, TabSet } from '../exploring/tab-set/model';

// The desktop app's tab strip, at the left of the page bar: one tab per place (tabs.ts), as a browser's tabs. A tab
// shows the record its place is on, its ID in mono and its title, cut short, with both in full in its tooltip; a
// group's tab shows its label ("Use cases (7)"). A click activates a tab, a middle-click or its close button closes it.
// With the strip focused the arrow keys, Home and End move between tabs, Enter or Space activates the focused one and
// Delete closes it. Tabs that do not fit scroll sideways. On the web there is no strip: the browser's tabs are the places.

export const TAB_PANEL_ID = 'tab-panel';
export const tabId = (key: string) => `tab-${key}`;

/** What a tab shows for the address its place is at: the ID (none for a group) and the title. */
export function tabLabel(index: RecordIndex, address: string): { id?: string; title: string } {
  const page = address.split(/[?#]/)[0];
  const route = parseSpecRoute(page, index);
  if (!isFocusRoute(route)) return { title: page };
  const focus = focusOf(route);
  if (route.page === 'group') return { title: isGroup(index, focus) ? groupLabel(index, focus) : focus };
  return { id: focus, title: index.byId.get(focus)?.title ?? 'Not found' };
}

export interface TabStripProps {
  index: RecordIndex;
  set: TabSet;
  onActivate: (key: string) => void;
  onClose: (key: string) => void;
}

export function TabStrip({ index, set, onActivate, onClose }: TabStripProps) {
  const strip = useRef<HTMLDivElement>(null);
  const tabEl = (key: string) => strip.current?.querySelector<HTMLElement>(`#${tabId(key)}`) ?? null;

  // The active tab scrolls into view.
  useEffect(() => {
    if (set.active) tabEl(set.active)?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [set.active]);

  const focusTab = (key: string | undefined) => { if (key) setTimeout(() => tabEl(key)?.focus(), 0); };

  const onKeyDown = (e: KeyboardEvent<HTMLElement>, tab: Tab, i: number) => {
    const tabs = set.tabs;
    let to: number | null = null;
    if (e.key === 'ArrowRight') to = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') to = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') to = 0;
    else if (e.key === 'End') to = tabs.length - 1;
    if (to !== null) { e.preventDefault(); tabEl(tabs[to].key)?.focus(); return; }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onActivate(tab.key); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      const neighbor = tabs.length > 1 ? (tabs[i + 1] ?? tabs[i - 1]).key : tab.key;
      onClose(tab.key);
      focusTab(tab.key === set.active ? neighbor : tabs.length > 1 ? neighbor : tab.key);
    }
  };

  /** A mouse wheel scrolls the strip sideways. */
  const onWheel = (e: WheelEvent<HTMLDivElement>) => {
    const el = strip.current;
    if (el && Math.abs(e.deltaY) > Math.abs(e.deltaX)) el.scrollLeft += e.deltaY;
  };

  return (
    <div ref={strip} className="tab-strip" role="tablist" aria-label="Open pages" onWheel={onWheel}>
      {set.tabs.map((tab, i) => {
        const address = hereOf(tab.place).address;
        const { id, title } = tabLabel(index, address);
        const active = tab.key === set.active;
        const name = id ? `${id} ${title}` : title;
        return (
          // The tab and its close button sit side by side in the .tab wrapper, never one inside the
          // other (LA-V61-R45); the tab is named by what it shows (LA-V61-R44). The close button is
          // for the pointer: a tablist holds only tabs, so it is hidden from the accessibility tree, and
          // the keyboard closes a tab with Delete or Alt+Shift+W.
          <div
            key={tab.key}
            className={`tab${active ? ' is-active' : ''}`}
            data-page={address.split(/[?#]/)[0]}
            onClick={() => onActivate(tab.key)}
            onMouseDown={(e: MouseEvent) => { if (e.button === 1) e.preventDefault(); }}
            onAuxClick={(e: MouseEvent) => { if (e.button === 1) { e.preventDefault(); onClose(tab.key); } }}
          >
            <Tooltip label={name}>
              <div
                id={tabId(tab.key)}
                role="tab"
                aria-selected={active}
                aria-controls={active ? TAB_PANEL_ID : undefined}
                tabIndex={active ? 0 : -1}
                className="tab-label"
                onKeyDown={(e) => onKeyDown(e, tab, i)}
              >
                {/* Keyed by its page: a new page in the tab is new text, drawn in place, never the old text moved (UX-R08). */}
                <span key={address} className="tab-text">
                  {id && <span className="tab-id">{id}</span>}
                  {id && ' '}
                  <span className="tab-title">{title}</span>
                </span>
              </div>
            </Tooltip>
            <Tooltip label="Close" command={active ? 'closeTab' : undefined}>
              <button
                type="button"
                className="tab-close"
                tabIndex={-1}
                aria-hidden="true"
                aria-label={`Close ${name}`}
                onClick={(e) => { e.stopPropagation(); onClose(tab.key); }}
              >
                <Icon name="x" size={13} />
              </button>
            </Tooltip>
          </div>
        );
      })}
    </div>
  );
}
