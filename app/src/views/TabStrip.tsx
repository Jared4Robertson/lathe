import { useEffect, useRef, type KeyboardEvent, type MouseEvent, type WheelEvent } from 'react';
import { Icon } from '../components/icons';
import { groupLabel, isGroup } from '../graph/model';
import { Tooltip } from '../shell/Tooltip';
import { parseSpecRoute, type SpecIndex } from '../specs/data';
import { focusOf, isFocusRoute } from './address';
import type { PageTab, PageTabs } from './useTabs';

// The tab strip, at the left of the leftmost pane's title bar: one tab per open page, as VS Code's
// editor tabs. A tab shows its record's ID in mono and its title, cut short, with both in full in
// its tooltip; a group tab shows its label ("Use cases (7)"). The preview tab's title is italic.
// A click activates a tab, a double-click keeps it, a middle-click or its close button closes it.
// With the strip focused the arrow keys, Home and End move between tabs, Enter or Space activates
// the focused one and Delete closes it. Tabs that do not fit scroll sideways.

export const TAB_PANEL_ID = 'tab-panel';
export const tabId = (key: string) => `tab-${key}`;

/** What a tab shows for its page: the ID (none for a group) and the title. */
export function tabLabel(index: SpecIndex, page: string): { id?: string; title: string } {
  const route = parseSpecRoute(page, index);
  if (!isFocusRoute(route)) return { title: page };
  const focus = focusOf(route);
  if (route.page === 'group') return { title: isGroup(index, focus) ? groupLabel(index, focus) : focus };
  return { id: focus, title: index.byId.get(focus)?.title ?? 'Not found' };
}

export interface TabStripProps {
  index: SpecIndex;
  set: PageTabs;
  onActivate: (key: string) => void;
  onClose: (key: string) => void;
  onKeep: (key: string) => void;
}

export function TabStrip({ index, set, onActivate, onClose, onKeep }: TabStripProps) {
  const strip = useRef<HTMLDivElement>(null);
  const tabEl = (key: string) => strip.current?.querySelector<HTMLElement>(`#${tabId(key)}`) ?? null;

  // The active tab scrolls into view.
  useEffect(() => {
    if (set.active) tabEl(set.active)?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [set.active]);

  const focusTab = (key: string | undefined) => { if (key) setTimeout(() => tabEl(key)?.focus(), 0); };

  const onKeyDown = (e: KeyboardEvent<HTMLElement>, tab: PageTab, i: number) => {
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
        const { id, title } = tabLabel(index, tab.page);
        const active = tab.key === set.active;
        const name = id ? `${id} ${title}` : title;
        return (
          // The tab and its close button sit side by side in the .tab wrapper, never one inside the
          // other (LA-PLT-DR22); the tab is named by what it shows (LA-PLT-DR21). The close button is
          // for the pointer: a tablist holds only tabs, so it is hidden from the accessibility tree, and
          // the keyboard closes a tab with Delete or Alt+Shift+W.
          <div
            key={tab.key}
            className={`tab${active ? ' is-active' : ''}${tab.preview ? ' is-preview' : ''}`}
            data-page={tab.page}
            onClick={() => onActivate(tab.key)}
            onDoubleClick={() => onKeep(tab.key)}
            onMouseDown={(e: MouseEvent) => { if (e.button === 1) e.preventDefault(); }}
            onAuxClick={(e: MouseEvent) => { if (e.button === 1) { e.preventDefault(); onClose(tab.key); } }}
          >
            <Tooltip label={tab.preview ? `${name} (preview: double-click to keep open)` : name} command={tab.preview && active ? 'keepTab' : undefined}>
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
                <span key={tab.page} className="tab-text">
                  {id && <span className="tab-id">{id}</span>}
                  {id && ' '}
                  <span className="tab-title">{title}</span>
                  {tab.preview && <span className="sr-only">, preview</span>}
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
                onDoubleClick={(e) => e.stopPropagation()}
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
