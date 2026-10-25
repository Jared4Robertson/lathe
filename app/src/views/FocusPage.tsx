import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { Icon } from '../components/icons';
import { ResizeHandle } from '../components/ResizeHandle';
import { expandAllOnPage } from '../components/TreeList';
import type { GraphSettings } from '../graph/GraphPage';
import { groupLabel, groupMembers, isGroup, parseGroupId, pluralLabel } from '../graph/model';
import type { GraphInfo } from '../graph/panel';
import { entryState, lastAddressMove, Link, navigate, noteInEntry, onLeaveEntry } from '../router';
import { useAnnounce, useCommand } from '../shell/commands';
import { BottomSheet } from '../shell/BottomSheet';
import { Tooltip } from '../shell/Tooltip';
import { isBool, usePanelSize, usePref, writePref } from '../shell/prefs';
import { useNarrow } from '../shell/useNarrow';
import { recordPath, type Problem, type SpecIndex, type SpecState } from '../specs/data';
import { Markdown } from '../specs/Markdown';
import { PageHeader, ProblemBadge, RecordTree, Section, listTitle } from '../specs/parts';
import { RecordContent, RecordEyebrow } from '../specs/RecordContent';
import { folderPath, testGroups } from '../specs/folders';
import { GroupSections } from '../specs/FolderGroups';
import { DomainWiki, NotFound, ProductWiki, SourceNote, problemsUnder } from '../specs/SpecPages';
import { addressOf, focusOf, VIEW_LABELS, VIEW_NAMES, viewsFromSearch, viewsOffered, viewsShown, withView, type FocusRoute, type ViewName } from './address';
import { Inspector } from './Inspector';
import { PageBar, ViewIcon } from './PageBar';
import { TAB_PANEL_ID, tabId, tabLabel } from './TabStrip';
import { PANE_SIZE_KEY, PANE_WEIGHT, PANE_WEIGHT_MAX, PANE_WEIGHT_MIN, VIEW_KEY, saveLastSettings, usePageTabs, type PageTabsApi, type TabView } from './useTabs';
import { Button } from '../components/Button';

// One page for one thing (a record, a group, a product or a domain), at one address, in up to
// three views, each a pane you open and close: Wiki (the page to read), Graph (the graph centered
// on it) and Model (the ERD of a domain, an aggregate or an entity's aggregate; offered only there).
// The open panes sit side by side in the order Wiki, Graph, Model, with a handle to drag in every
// gap. Every pane shows the same focus: clicking a node or a box changes the address and the others
// follow. Any pane can be maximized. The inspector, the page's last column, shows the focused
// record whichever views are open.
//
// Several pages can be open at once, as tabs in the leftmost pane's title bar (useTabs.ts and
// tabs.ts); each tab keeps its own views, pane sizes, wiki scroll and graph settings.

const GraphView = lazy(() => import('../graph/GraphPage').then((m) => ({ default: m.GraphView })));
const ModelView = lazy(() => import('../model/ModelView').then((m) => ({ default: m.ModelView })));

const INSPECTOR_KEY = 'lathe:inspector-open';
const INSPECTOR_WIDTH_KEY = 'lathe:inspector-width';
/** The narrowest a pane gets, and the limits of one pane's share of the two panes beside a gap, in percent. */
const PANE_MIN_PX = 220;
const GAP_MIN = 20;
const GAP_MAX = 80;
const lower = (v: ViewName) => VIEW_LABELS[v].toLowerCase();
/** The key a history entry notes the wiki's scroll under. */
const WIKI_SCROLL = 'wikiScroll';

// ---------- The page ----------

export function FocusPage({ spec, route, search }: { spec: SpecState; route: FocusRoute; search: string }) {
  const { index } = spec;
  let body: ReactNode;
  if (!index) body = <div className="placeholder"><p>{spec.error ? `Couldn't load the specs: ${spec.error}` : 'Loading specs…'}</p></div>;
  else {
    const problem = invalid(index, route);
    body = problem ?? <Focused index={index} route={route} search={search} />;
  }
  return (
    <main className="focus-page" id="main">
      <SourceNote spec={spec} />
      {spec.error && index && <p className="error">Couldn't reload the specs: {spec.error}</p>}
      {body}
    </main>
  );
}

function invalid(index: SpecIndex, route: FocusRoute): ReactNode | null {
  if (route.page === 'product') {
    return index.byId.get(route.product)?.kind === 'product' ? null : <NotFound what="product" id={route.product} />;
  }
  if (route.page === 'domain') {
    const d = index.byId.get(route.domain);
    return d?.kind === 'domain' && d.product === route.product ? null : <NotFound what="domain" id={route.domain} />;
  }
  const id = focusOf(route);
  if (route.page === 'record' ? index.byId.has(id) : isGroup(index, id)) return null;
  return (
    <div className="placeholder">
      <p>There's no record or group <code>{id}</code>. <Link to="/specs">See all products</Link>.</p>
    </div>
  );
}

function Focused({ index, route, search }: { index: SpecIndex; route: FocusRoute; search: string }) {
  const focus = focusOf(route);
  const announce = useAnnounce();
  const narrow = useNarrow();

  // The open tabs, and the active one's state. The open views are the tab's: those the link named
  // when it opened, otherwise those of the tab it was opened from ("wiki,graph"; the old single
  // names and "split" read the same way). Model shows only where it is offered; the views asked for
  // but not offered here are kept, so they come back on a page that offers them.
  const tabs = usePageTabs(index, route, search);
  const tab = tabs.active;
  const { update } = tabs;
  const asked = tab.state.views;
  const askedKey = asked.join(',');
  // The views a link names become the ones remembered, for the first tab of a new session.
  const linked = viewsFromSearch(search) !== null;
  useEffect(() => { if (linked && !narrow) writePref(VIEW_KEY, askedKey); }, [linked, askedKey, narrow]);
  const offered = viewsOffered(index, focus);
  const open = viewsShown(asked, offered);
  const openKey = open.join(',');

  const toggles = useRef<Partial<Record<ViewName, HTMLButtonElement | null>>>({});
  const lastToggled = useRef<ViewName | null>(null);

  // A maximized pane: the only one shown, until it is restored.
  const [fullState, setFull] = useState<ViewName | null>(null);
  const full = fullState && open.includes(fullState) ? fullState : null;
  const fullButtons = useRef<Partial<Record<ViewName, HTMLButtonElement | null>>>({});

  const setViews = useCallback((next: ViewName[], message: string) => {
    const keep = asked.filter((v) => !offered.includes(v));
    const views = VIEW_NAMES.filter((v) => next.includes(v) || keep.includes(v));
    // Switching a tab's views keeps it open, as in VS Code.
    update((s) => ({ ...s, views }), true);
    writePref(VIEW_KEY, views.join(','));
    navigate(withView(window.location.pathname, views), true);
    setFull(null);
    announce(message);
  }, [asked, offered, update, announce]);

  /**
   * On a phone one view shows at a time: this one, named in the address and kept by the tab. The
   * views remembered for a wider screen are left alone, and the views not offered here are kept.
   */
  const showOnly = useCallback((view: ViewName) => {
    if (!offered.includes(view) || (open.length === 1 && open[0] === view)) return;
    const keep = asked.filter((v) => !offered.includes(v));
    const views = VIEW_NAMES.filter((v) => v === view || keep.includes(v));
    update((s) => ({ ...s, views }));
    navigate(withView(window.location.pathname, views), true);
    announce(`${VIEW_LABELS[view]} view`);
  }, [asked, offered, open, update, announce]);

  /** Turns a view on or off; the last open view stays open. On a phone, shows that view alone. */
  const toggleView = useCallback((view: ViewName) => {
    if (narrow) { showOnly(view); return; }
    if (!offered.includes(view)) return;
    lastToggled.current = view;
    if (open.includes(view)) {
      if (open.length === 1) { announce(`The ${lower(view)} view stays open: it is the only one`); return; }
      setViews(open.filter((v) => v !== view), `${VIEW_LABELS[view]} view closed`);
    } else {
      setViews([...open, view], `${VIEW_LABELS[view]} view opened`);
    }
  }, [narrow, showOnly, offered, open, setViews, announce]);

  // Keep focus when the element that had it went away with a pane: on the toggle just used.
  useEffect(() => {
    const active = document.activeElement;
    if (active && active !== document.body && active.isConnected) return;
    const view = lastToggled.current && toggles.current[lastToggled.current] ? lastToggled.current : open[0];
    toggles.current[view]?.focus();
  }, [openKey]);

  const toggleFull = useCallback((pane: ViewName) => {
    setFull((f) => {
      const next = f === pane ? null : pane;
      announce(next ? `${VIEW_LABELS[next]} pane full screen. Escape returns.` : 'Full screen closed');
      return next;
    });
  }, [announce]);
  useEffect(() => {
    if (full) fullButtons.current[full]?.focus();
  }, [full]);
  const leaveFull = useCallback(() => {
    const pane = full;
    setFull(null);
    announce('Full screen closed');
    setTimeout(() => { if (pane) fullButtons.current[pane]?.focus(); }, 0);
  }, [full, announce]);

  // Pane sizes: the tab's weight per view, so each gap between two open panes resizes them. The
  // last sizes set are also remembered, for the first tab of a new session.
  const setSize = useCallback((v: ViewName, weight: number) => {
    const w = Math.round(Math.min(PANE_WEIGHT_MAX, Math.max(PANE_WEIGHT_MIN, weight)));
    update((s) => (s.sizes[v] === w ? s : { ...s, sizes: { ...s.sizes, [v]: w } }));
    writePref(PANE_SIZE_KEY(v), w);
  }, [update]);
  const sizes = Object.fromEntries(VIEW_NAMES.map((v) => [v, [tab.state.sizes[v] ?? PANE_WEIGHT, (w: number) => setSize(v, w)] as const])) as Record<ViewName, readonly [number, (w: number) => void]>;
  const views = useRef<HTMLDivElement>(null);
  const paneEl = (v: ViewName) => views.current?.querySelector<HTMLElement>(`:scope > .pane-${v}`) ?? null;

  // The inspector.
  const [inspectorOpen, setInspectorOpen] = usePref<boolean>(INSPECTOR_KEY, true, isBool);
  const [inspectorWidth, setInspectorWidth, resetInspectorWidth] = usePanelSize(INSPECTOR_WIDTH_KEY, 340, 260, 640);
  const layout = useRef<HTMLDivElement>(null);
  const [drawer, setDrawer] = useState(false);
  const inspector = useRef<HTMLElement>(null);
  const inspectorButton = useRef<HTMLButtonElement>(null);
  const showing = narrow ? drawer : inspectorOpen;
  const setShowing = useCallback((show: boolean) => {
    if (narrow) setDrawer(show); else setInspectorOpen(show);
    announce(show ? 'Inspector shown' : 'Inspector hidden');
    if (!show) setTimeout(() => inspectorButton.current?.focus(), 0);
  }, [narrow, setInspectorOpen, announce]);
  useEffect(() => { setDrawer(false); }, [focus, narrow]);
  const openInspectorAt = useCallback((selector?: string) => {
    if (!showing) setShowing(true);
    setTimeout(() => {
      const target = (selector && inspector.current?.querySelector<HTMLElement>(selector)) || inspector.current;
      target?.focus();
      target?.scrollIntoView?.({ block: 'nearest' });
    }, 0);
  }, [showing, setShowing]);

  // Graph settings are the tab's, and survive moving between pages and views; the last ones set start a new session's first tab.
  const settings = tab.state.graph;
  const setSettings = useCallback((s: GraphSettings) => { update((t: TabView) => ({ ...t, graph: s })); saveLastSettings(s); }, [update]);
  const [graphInfo, setGraphInfo] = useState<GraphInfo | null>(null);
  const onGraph = useCallback((info: GraphInfo) => setGraphInfo(info), []);

  // A link keeps the views asked for; the page it leads to shows those it offers.
  const hrefFor = useCallback((id: string) => withView(addressOf(index, id), asked), [index, askedKey]);
  const onNavigate = useCallback((id: string) => navigate(hrefFor(id)), [hrefFor]);

  // The wiki's scroll is the tab's: it comes back when the tab is active again. Within a tab, a new
  // page starts at the top, and Back and Forward come back to where that history entry was scrolled
  // (noted in the entry), set before paint so the page is never drawn at the wrong place (UX-R08).
  const wikiPane = useRef<HTMLDivElement>(null);
  const wikiOpen = open.includes('wiki');
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const shown = useRef<{ key: string; page: string } | null>(null);
  useLayoutEffect(() => {
    const before = shown.current;
    shown.current = { key: tab.key, page: tab.page };
    const el = wikiPane.current;
    if (!el) return;
    let top = tabs.scrollOf(tabRef.current);
    if (before && before.key === tab.key && before.page !== tab.page) {
      const noted = entryState<number>(WIKI_SCROLL);
      top = lastAddressMove() === 'pop' && typeof noted === 'number' ? noted : 0;
      tabs.setScroll(tabRef.current, top);
    }
    el.scrollTop = top;
    // Parts of the page may still settle their size before the first paint (a section's actions
    // slot, a list measuring its rows), so the scroll is set again once layout is done, still
    // before that paint: a ResizeObserver reports after layout and before paint, once on observe.
    if (top <= 0 || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => { el.scrollTop = top; observer.disconnect(); });
    for (const child of el.children) observer.observe(child);
    return () => observer.disconnect();
  }, [tab.key, tab.page, wikiOpen, tabs.scrollOf, tabs.setScroll]);
  // The entry notes the wiki's scroll as it changes (after a pause) and as a new page is opened from it.
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteScroll = useCallback(() => {
    if (noteTimer.current) { clearTimeout(noteTimer.current); noteTimer.current = null; }
    if (wikiPane.current) noteInEntry(WIKI_SCROLL, Math.round(wikiPane.current.scrollTop));
  }, []);
  useEffect(() => onLeaveEntry(noteScroll), [noteScroll]);
  useEffect(() => () => { if (noteTimer.current) clearTimeout(noteTimer.current); }, []);
  const onWikiScroll = useCallback(() => {
    if (!wikiPane.current) return;
    tabs.setScroll(tabRef.current, wikiPane.current.scrollTop);
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(noteScroll, 200);
  }, [tabs.setScroll, noteScroll]);

  // Commands.
  useCommand('viewWiki', () => toggleView('wiki'));
  useCommand('viewGraph', () => toggleView('graph'));
  useCommand('viewModel', () => toggleView('model'), offered.includes('model'));
  useCommand('maximizePane', () => {
    if (full) { leaveFull(); return; }
    const inPane = (document.activeElement as HTMLElement | null)?.closest?.<HTMLElement>('.pane')?.dataset.view;
    toggleFull(open.find((v) => v === inPane) ?? open[0]);
  });
  useCommand('escape', leaveFull, full !== null);
  useCommand('toggleInspector', () => setShowing(!showing));
  useCommand('focusInspector', () => openInspectorAt());
  useCommand('showReferences', () => openInspectorAt('.links-in-heading'), index.byId.has(focus));
  useCommand('expandAll', () => { expandAllOnPage(true); announce('Expanded every row'); });
  useCommand('collapseAll', () => { expandAllOnPage(false); announce('Collapsed every row'); });
  // Tabs.
  useCommand('keepTab', () => { tabs.keep(tab.key); announce('Tab kept open'); });
  useCommand('closeTab', () => { tabs.close(tab.key); announce(tabs.set.tabs.length > 1 ? 'Tab closed' : 'The last tab stays open, as a preview'); });
  useCommand('nextTab', () => tabs.cycle(1), tabs.set.tabs.length > 1);
  useCommand('previousTab', () => tabs.cycle(-1), tabs.set.tabs.length > 1);

  const content: Record<ViewName, ReactNode> = {
    wiki: <WikiContent index={index} route={route} />,
    graph: (
      <Suspense fallback={<p className="hint graph-loading">Loading the graph…</p>}>
        <GraphView index={index} focus={focus} onNavigate={onNavigate} hrefFor={hrefFor} settings={settings} onSettingsChange={setSettings} onGraph={onGraph} />
      </Suspense>
    ),
    model: (
      <Suspense fallback={<p className="hint graph-loading">Loading the model…</p>}>
        <ModelView index={index} focus={focus} onNavigate={onNavigate} />
      </Suspense>
    ),
  };

  /** The pane shown furthest left (the maximized one, when one is), which carries the page's title. */
  const leftmost: ViewName = full ?? open[0];

  /**
   * One pane: a panel with one slim header (LA-PAT-APP-UX-R03), naming its view at the left and
   * holding only the pane's own actions at the right, all icon buttons in one style: its close
   * button when more than one pane is open, and its full screen button. The page's tabs, the View
   * toggles and the inspector toggle are the page bar's.
   */
  const pane = (view: ViewName) => {
    const isFull = full === view;
    const name = VIEW_LABELS[view];
    return (
      <section
        key={view}
        data-view={view}
        className={`pane panel pane-${view}${isFull ? ' is-fullscreen' : ''}`}
        aria-label={`${name} pane`}
        inert={full !== null && !isFull ? true : undefined}
        onKeyDown={isFull ? (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); leaveFull(); } } : undefined}
      >
        <div className="pane-bar">
          <div className="pane-head">
            <span className="pane-name"><ViewIcon view={view} size={15} /> {name}</span>
          </div>
          <div className="pane-actions">
            {open.length > 1 && (
              <Tooltip label={`Close the ${lower(view)} pane`}>
                <Button variant="icon" className="pane-close" label={`Close the ${lower(view)} pane`} onClick={() => toggleView(view)}>
                  <Icon name="x" size={14} />
                </Button>
              </Tooltip>
            )}
            <Tooltip label={isFull ? 'Leave full screen' : 'Full screen'} command={isFull ? 'escape' : 'maximizePane'} placement="left">
              <Button
                variant="icon"
                ref={(el) => { fullButtons.current[view] = el; }}
                aria-pressed={isFull}
                label={isFull ? `Leave full screen (${name})` : `Full screen: ${name}`}
                onClick={() => (isFull ? leaveFull() : toggleFull(view))}
              >
                <Icon name={isFull ? 'minimize' : 'maximize'} size={16} />
              </Button>
            </Tooltip>
          </div>
        </div>
        <div className={view === 'wiki' ? 'pane-scroll' : 'pane-body'} ref={view === 'wiki' ? wikiPane : undefined} onScroll={view === 'wiki' ? onWikiScroll : undefined}>
          {view === leftmost && <PageTitle index={index} route={route} fixed={view !== 'wiki'} />}
          {content[view]}
        </div>
      </section>
    );
  };


  /** The handle in the gap between two open panes: the left one's share of the two, in percent. */
  const gap = (a: ViewName, b: ViewName) => {
    const [wa, setA] = sizes[a];
    const [wb, setB] = sizes[b];
    const total = wa + wb;
    const value = Math.round((wa / total) * 100);
    const valueAt = (clientX: number) => {
      const left = paneEl(a)?.getBoundingClientRect();
      const right = paneEl(b)?.getBoundingClientRect();
      return left && right && right.right > left.left ? ((clientX - left.left) / (right.right - left.left)) * 100 : value;
    };
    return (
      <ResizeHandle
        key={`${a}-${b}`}
        className="pane-gap"
        label={`Resize the ${lower(a)} and ${lower(b)} panes`}
        value={value}
        min={GAP_MIN}
        max={GAP_MAX}
        step={5}
        bigStep={10}
        valueAt={valueAt}
        onChange={(pct) => { const next = Math.round((total * pct) / 100); setA(next); setB(total - next); }}
        onReset={() => { setA(Math.round(total / 2)); setB(total - Math.round(total / 2)); }}
      />
    );
  };

  if (narrow) {
    return (
      <PhoneLayout
        index={index}
        route={route}
        front={open[0]}
        offered={offered}
        tabs={tabs}
        onView={showOnly}
        wikiPane={wikiPane}
        onWikiScroll={onWikiScroll}
        content={content[open[0]]}
        inspectorShown={showing}
        onInspector={setShowing}
        inspectorButton={inspectorButton}
        inspector={(
          <Inspector
            ref={inspector}
            index={index}
            focus={focus}
            graph={open.includes('graph') ? graphInfo : null}
            onNavigate={onNavigate}
            hrefFor={hrefFor}
            onClose={() => setShowing(false)}
            drawer
          />
        )}
        inspectorRef={inspector}
      />
    );
  }


  const columns = open.map((v) => `minmax(${PANE_MIN_PX}px, ${sizes[v][0]}fr)`).join(' var(--panel-gap) ');
  return (
    <div
      ref={layout}
      className={`focus-layout${showing ? ' with-inspector' : ''}`}
      style={{ '--inspector-width': `${inspectorWidth}px` } as CSSProperties}
    >
      <div className="focus-main">
        <PageBar
          index={index}
          tabs={tabs}
          offered={offered}
          open={open}
          onView={toggleView}
          compact={false}
          inspectorShown={showing}
          onInspector={setShowing}
          inspectorButton={inspectorButton}
          toggles={toggles}
        />
        <div
          ref={views}
          id={TAB_PANEL_ID}
          role="tabpanel"
          aria-labelledby={tab.key ? tabId(tab.key) : undefined}
          className={`focus-views panes-${open.length}`}
          data-views={openKey}
          style={open.length > 1 ? { gridTemplateColumns: columns } : undefined}
        >
          {open.flatMap((v, i) => (i === 0 ? [pane(v)] : [gap(open[i - 1], v), pane(v)]))}
        </div>
      </div>
      {showing ? (
        <>
          <ResizeHandle
            label="Resize the inspector"
            side="after"
            value={inspectorWidth}
            min={260}
            max={640}
            step={16}
            bigStep={64}
            valueAt={(x) => (layout.current?.getBoundingClientRect().right ?? x) - x}
            onChange={setInspectorWidth}
            onReset={resetInspectorWidth}
            collapseBelow={160}
            onCollapse={() => setShowing(false)}
          />
          <div className="inspector-column panel">
            <Inspector
              ref={inspector}
              index={index}
              focus={focus}
              graph={open.includes('graph') ? graphInfo : null}
              onNavigate={onNavigate}
              hrefFor={hrefFor}
              onClose={() => setShowing(false)}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

// ---------- The phone layout ----------

interface PhoneLayoutProps {
  index: SpecIndex;
  route: FocusRoute;
  /** The one view shown: the first of those the address names. */
  front: ViewName;
  offered: ViewName[];
  tabs: PageTabsApi;
  onView: (view: ViewName) => void;
  wikiPane: RefObject<HTMLDivElement | null>;
  onWikiScroll: () => void;
  content: ReactNode;
  inspectorShown: boolean;
  onInspector: (show: boolean) => void;
  inspectorButton: RefObject<HTMLButtonElement | null>;
  inspector: ReactNode;
  inspectorRef: RefObject<HTMLElement | null>;
}

/**
 * On a phone (notes/mobile-design.md) the page shows one view at a time, full width, with no pane
 * headers and no handles. The page bar is the same bar as on a wide screen, compact, under the
 * shell's top bar (which names the page): the open pages as a sheet, the View switch, and the
 * inspector as a bottom sheet.
 */
function PhoneLayout(props: PhoneLayoutProps) {
  const { index, route, front, offered, tabs, onView, wikiPane, onWikiScroll, content, inspectorShown, onInspector, inspectorButton, inspector, inspectorRef } = props;
  const [pagesOpen, setPagesOpen] = useState(false);
  const pagesButton = useRef<HTMLButtonElement>(null);
  const pagesSheet = useRef<HTMLUListElement>(null);
  const count = tabs.set.tabs.length;
  const closePages = useCallback(() => { setPagesOpen(false); setTimeout(() => pagesButton.current?.focus(), 0); }, []);
  useEffect(() => { if (pagesOpen) pagesSheet.current?.querySelector<HTMLElement>('[aria-current], button')?.focus(); }, [pagesOpen]);
  // The inspector sheet takes focus as it opens; closing it gives focus back to its button.
  useEffect(() => { if (inspectorShown) inspectorRef.current?.focus(); }, [inspectorShown, inspectorRef]);
  const page = focusOf(route);
  useEffect(() => { setPagesOpen(false); }, [page]);

  return (
    <div className="focus-layout is-phone">
      <PageBar
        index={index}
        tabs={tabs}
        offered={offered}
        open={[front]}
        onView={onView}
        compact
        inspectorShown={inspectorShown}
        onInspector={onInspector}
        inspectorButton={inspectorButton}
        pagesOpen={pagesOpen}
        onPages={() => setPagesOpen(true)}
        pagesButton={pagesButton}
      />
      <section data-view={front} className={`pane panel pane-${front}`} aria-label={`${VIEW_LABELS[front]} pane`}>
        <div className={front === 'wiki' ? 'pane-scroll' : 'pane-body'} ref={front === 'wiki' ? wikiPane : undefined} onScroll={front === 'wiki' ? onWikiScroll : undefined}>
          {front === 'wiki' && <PageTitle index={index} route={route} />}
          {content}
        </div>
      </section>
      {inspectorShown && (
        <BottomSheet label="Inspector" className="inspector-sheet" onClose={() => onInspector(false)}>
          {inspector}
        </BottomSheet>
      )}
      {pagesOpen && (
        <BottomSheet label="Open pages" className="pages-sheet" onClose={closePages}>
          <div className="sheet-head">
            <h2 className="sheet-title">Open pages <span className="section-count">{count}</span></h2>
            <Button variant="icon" label="Close the open pages" onClick={closePages}><Icon name="x" /></Button>
          </div>
          <ul ref={pagesSheet} className="pages-list" aria-label="Open pages">
            {tabs.set.tabs.map((t) => {
              const { id, title } = tabLabel(index, t.page);
              const active = t.key === tabs.set.active;
              const name = id ? `${id} ${title}` : title;
              return (
                <li key={t.key} className={`pages-row${active ? ' is-active' : ''}${t.preview ? ' is-preview' : ''}`}>
                  <button
                    type="button"
                    className="pages-open"
                    aria-current={active ? 'page' : undefined}
                    aria-label={t.preview ? `${name}, preview` : name}
                    onClick={() => { tabs.activate(t.key); closePages(); }}
                  >
                    {id && <span className="tab-id">{id}</span>}
                    <span className="tab-title">{title}</span>
                  </button>
                  {t.preview && (
                    <Button className="pages-keep" label={`Keep ${name} open`} onClick={() => tabs.keep(t.key)}>Keep</Button>
                  )}
                  <Button variant="icon" label={`Close ${name}`} onClick={() => tabs.close(t.key)}>
                    <Icon name="x" size={16} />
                  </Button>
                </li>
              );
            })}
          </ul>
          <p className="hint pages-hint">A page you open replaces the preview (in italics); keep one to hold it open.</p>
        </BottomSheet>
      )}
    </div>
  );
}

// ---------- Title ----------

/** The page's title: its eyebrow, title, ID and problems, at the top of the pane that shows it. */
function PageTitle({ index, route, fixed = false }: { index: SpecIndex; route: FocusRoute; fixed?: boolean }) {
  const focus = focusOf(route);
  let eyebrow: ReactNode;
  let title: string;
  let id: string | undefined = focus;
  let problems: Problem[];
  if (route.page === 'product') {
    const product = index.byId.get(focus)!;
    eyebrow = <>Product · <Link to={recordPath(focus)}>{product.path}</Link></>;
    title = product.title;
    problems = problemsUnder(index, 'product', focus);
  } else if (route.page === 'domain') {
    const domain = index.byId.get(focus)!;
    const product = index.byId.get(route.product)!;
    eyebrow = <><Link to={addressOf(index, product.id)}>{product.title}</Link> · Domain · <Link to={recordPath(focus)}>{domain.path}</Link></>;
    title = domain.title;
    problems = problemsUnder(index, 'domain', focus);
  } else if (route.page === 'record') {
    const record = index.byId.get(focus)!;
    eyebrow = <RecordEyebrow index={index} record={record} />;
    title = record.title;
    problems = index.problemsFor.get(focus) ?? [];
  } else {
    const parent = index.byId.get(route.parent)!;
    // The folder the group's kind sits in, named as in the side nav and the domain page: "Define › Use cases".
    const folder = folderPath(index, route.kind.split('/')[0]);
    eyebrow = <><Link to={addressOf(index, parent.id)}>{parent.title}</Link> · {folder.length > 0 && <span className="group-folder">{folder.join(' › ')} · </span>}Group</>;
    title = groupLabel(index, focus);
    id = undefined;
    problems = groupMembers(index, focus).flatMap((m) => index.problemsFor.get(m.id) ?? []);
  }
  return (
    // Above a graph or a model the title keeps one fixed height (one line, cut with an ellipsis, the
    // whole title in its tooltip), so the canvas below never moves when the focus changes. The header
    // is keyed by the focus: a new page's header is new content drawn in place, never the last one's
    // badge slid along by a title of another length (UX-R08). The title's box itself stays.
    <div className={`pane-title${fixed ? ' is-fixed' : ''}`} title={fixed ? title : undefined}>
      <PageHeader key={focus} eyebrow={eyebrow} title={title} id={id}>
        <ProblemBadge problems={problems} />
      </PageHeader>
    </div>
  );
}

// ---------- Wiki content ----------

function WikiContent({ index, route }: { index: SpecIndex; route: FocusRoute }) {
  switch (route.page) {
    case 'product': return <ProductWiki index={index} id={route.product} />;
    case 'domain': return <DomainWiki index={index} id={route.domain} />;
    case 'record': return <div className="spec-body"><RecordContent index={index} id={route.id} header={false} side={false} /></div>;
    case 'group': return <GroupWiki index={index} gid={focusOf(route)} />;
  }
}

/** A group's wiki page: its parent, its kind, and its members, each with its coverage marks and its own children folded. */
function GroupWiki({ index, gid }: { index: SpecIndex; gid: string }) {
  const { parent, kind } = parseGroupId(gid)!;
  const members = groupMembers(index, gid);
  const parentRecord = index.byId.get(parent)!;
  const description = index.kinds.get(kind)?.description;
  // A list of one kind is titled by that kind ("Use cases", "Tests"); a mixed one stays "Members".
  const membersTitle = listTitle(index, members, 'Members');
  return (
    <div className="spec-body">
      <p className="group-intro">
        {pluralLabel(index, kind)} of <Link to={addressOf(index, parent)} className="record-link"><code>{parent}</code> <span>{parentRecord.title}</span></Link>
      </p>
      {description && <Markdown source={description} />}
      <Section title={membersTitle} count={members.length}>
        {/* Tests are read in the test plan's groups, as on the domain page and in the nav. */}
        {kind === 'test' && testGroups(index, gid, members).length > 0
          ? <GroupSections index={index} groups={testGroups(index, gid, members)} level={3} />
          : <RecordTree index={index} records={members} label={`${membersTitle} of ${gid}`} />}
      </Section>
    </div>
  );
}
