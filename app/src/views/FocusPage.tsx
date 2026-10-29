// The focus page of a record or group at its address, /<id> (LA-V96): the stage and the panels floating over it.
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { Icon } from '../components/icons';
import { ResizeHandle } from '../components/ResizeHandle';
import { expandAllOnPage } from '../components/TreeList';
import { CARD_MAX, CARD_MIN, useSessionSettings } from '../graph/settings';
import { isGroup } from '../graph/model';
import type { GraphInfo } from '../graph/panel';
import { entryState, lastAddressMove, Link, navigate, noteInEntry, onLeaveEntry } from '../router';
import { useAnnounce, useCommand } from '../shell/commands';
import { BottomSheet } from '../shell/BottomSheet';
import { usePanelSize } from '../shell/prefs';
import { trapTab, useNarrow } from '../shell/useNarrow';
import { parseSpecRoute, type SpecIndex, type SpecState } from '../specs/data';
import { NotFound } from '../specs/SpecPages';
import { addressOf, HOME_PATH, focusOf, isFocusRoute, STAGE_LABELS, stageFromSearch, withStage, type FocusRoute, type StageName } from './address';
import { HeaderStrip } from './HeaderStrip';
import { createOpenSpaceStore, useOpenSpaceMeasure } from './openSpace';
import { PageBar, STAGE_COMMANDS } from './PageBar';
import { SideBar } from './SideBar';
import { createPeekStore, saveLastSide, SIDE_VIEW_LABELS, sideFor, type SideModeState, type SideView } from './sideBarState';
import { TAB_PANEL_ID, tabId, tabLabel } from './TabStrip';
import { rememberStage, usePageTabs, type PageTabsApi } from './useTabs';
import { WikiCard } from './WikiCard';
import { Button } from '../components/Button';
import { useViewState } from '../chat/appRequests';

// One page for one thing (a record, a group, a product or a domain), at one address. One stage
// fills the window behind everything: the Graph, the ERD (of a domain, an aggregate or an entity's
// aggregate, or of the domain or product around any other record) or the Trace (an obligation's chain, the
// matrix of the obligations under the focus, or the rows that hold it), switched in the page bar and named
// in the address (`?stage=erd`). Everything else floats over it as frosted panels: the nav (the
// shell's), the tab panel (the page bar, then the header strip naming the focus), the wiki card (the
// focus's wiki page) and the side bar (Details, Outline or History, SideBar.tsx). The stage frames
// its focus in the open space the panels leave (openSpace.ts), and every part follows one focus:
// a click on the stage, a link in the card, a tab, Back and Forward all change the address.
//
// Several pages can be open at once, as tabs (useTabs.ts and tabs.ts); each tab keeps its own
// stage, side bar and wiki card scroll. How the graph is drawn and the wiki card's open state and
// width are one setting for the session, not a tab's (graph/settings.ts).

const GraphView = lazy(() => import('../graph/GraphPage').then((m) => ({ default: m.GraphView })));
const ErdView = lazy(() => import('../erd/ErdView').then((m) => ({ default: m.ErdView })));
const TraceView = lazy(() => import('../trace/TraceView').then((m) => ({ default: m.TraceView })));

const SIDE_BAR_WIDTH_KEY = 'lathe:side-bar-width';
/** The key a history entry notes the wiki card's scroll under. */
const CARD_SCROLL = 'cardScroll';
/**
 * How long the focus must rest before the wiki card draws its page, in ms. A focus that moves after
 * a rest draws at once; moves that follow each other closer than this (arrowing through the stage)
 * draw only the one they settle on, so the card never draws a page per step.
 */
export const CARD_SETTLE_MS = 180;

// ---------- The page ----------

export function FocusPage({ spec, route, search }: { spec: SpecState; route: FocusRoute; search: string }) {
  const { index } = spec;
  let body: ReactNode;
  if (!index) body = <div className="placeholder focus-missing panel"><p>{spec.error ? `Couldn't load the specs: ${spec.error}` : 'Loading specs…'}</p></div>;
  else {
    const problem = invalid(index, route);
    body = problem ?? <Focused index={index} route={route} search={search} />;
  }
  return (
    <main className="stage-page" id="main">
      {spec.error && index && <p className="error">Couldn't reload the specs: {spec.error}</p>}
      {body}
    </main>
  );
}

function invalid(index: SpecIndex, route: FocusRoute): ReactNode | null {
  if (route.page === 'product') {
    return index.byId.get(route.product)?.kind === 'product' ? null : <div className="focus-missing panel"><NotFound what="product" id={route.product} /></div>;
  }
  if (route.page === 'domain') {
    const d = index.byId.get(route.domain);
    return d?.kind === 'domain' && d.product === route.product ? null : <div className="focus-missing panel"><NotFound what="domain" id={route.domain} /></div>;
  }
  const id = focusOf(route);
  if (route.page === 'record' ? index.byId.has(id) : isGroup(index, id)) return null;
  return (
    <div className="placeholder focus-missing panel">
      <p>There's no record or group <code>{id}</code>. <Link to={HOME_PATH}>See all products</Link>.</p>
    </div>
  );
}

/**
 * A value that follows `value` once it rests: at once after a rest, and when it moves again within
 * `ms`, only once it has rested that long. Set before paint, so no frame shows the old value after a rest.
 */
function useSettled<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  const lastMove = useRef(-Infinity);
  useLayoutEffect(() => {
    if (Object.is(value, settled)) return;
    const now = performance.now();
    const rested = now - lastMove.current > ms;
    lastMove.current = now;
    if (rested) { setSettled(value); return; }
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, settled, ms]);
  return settled;
}

function Focused({ index, route, search }: { index: SpecIndex; route: FocusRoute; search: string }) {
  const focus = focusOf(route);
  const announce = useAnnounce();
  const narrow = useNarrow();

  // The open tabs, and the active one's state. The stage is the tab's: the one the link named when
  // it opened, otherwise that of the tab it was opened from. Every stage works on every focus
  // (LA-PAT-APP-UX-R17), so the switch never hides or disables one.
  const tabs = usePageTabs(index, route, search);
  const tab = tabs.active;
  const { update } = tabs;
  const stage = tab.state.stage;

  const setStage = useCallback((next: StageName) => {
    if (next === stage) return;
    // Switching a tab's stage keeps it open, as in VS Code.
    update((s) => ({ ...s, stage: next }), true);
    // A phone's switch leaves the stage remembered for a wide screen alone.
    if (!narrow) rememberStage(next);
    navigate(withStage(window.location.pathname, next), true);
    announce(`${STAGE_LABELS[next]} stage`);
  }, [stage, narrow, update, announce]);
  // The stage a link names becomes the one remembered, for the first tab of a new session.
  const linked = stageFromSearch(search);
  useEffect(() => { if (linked && !narrow) rememberStage(linked); }, [linked, narrow]);
  // Focus lost with the stage it was on (a key switched the stage) lands on the new stage's button
  // in the switch. On a first load focus stays at the start, where Tab finds the skip link.
  const shownStage = useRef(stage);
  useEffect(() => {
    if (shownStage.current === stage) return;
    shownStage.current = stage;
    const active = document.activeElement;
    if (active && active !== document.body && active.isConnected) return;
    document.querySelector<HTMLElement>(`.page-bar [data-command="${STAGE_COMMANDS[stage]}"]`)?.focus();
  }, [stage]);

  // The side bar: open or not, and its view, per stage and per tab; the last choices made start a
  // space's first tab. On a phone it is a drawer, opened on demand.
  const side = sideFor(tab.state.side, stage);
  const setSide = useCallback((patch: Partial<SideModeState>) => {
    const next = { ...side, ...patch };
    update((s) => ({ ...s, side: { ...s.side, [stage]: next } }));
    saveLastSide(stage, next);
  }, [side, stage, update]);
  const [sideBarWidth, setSideBarWidth, resetSideBarWidth] = usePanelSize(SIDE_BAR_WIDTH_KEY, 340, 260, 640);
  const layout = useRef<HTMLDivElement>(null);
  const [drawer, setDrawer] = useState(false);
  const sideBarEl = useRef<HTMLElement>(null);
  const sideBarButton = useRef<HTMLButtonElement>(null);
  const showing = narrow ? drawer : side.open;
  const setShowing = useCallback((show: boolean) => {
    if (narrow) setDrawer(show); else setSide({ open: show });
    announce(show ? 'Side bar shown' : 'Side bar hidden');
    if (!show) setTimeout(() => sideBarButton.current?.focus(), 0);
  }, [narrow, setSide, announce]);
  const setSideView = useCallback((view: SideView) => {
    if (view === side.view) return;
    setSide({ view });
    announce(`${SIDE_VIEW_LABELS[view]} in the side bar`);
  }, [side.view, setSide, announce]);
  useEffect(() => { setDrawer(false); }, [focus, narrow]);
  // What the stages and the wiki card tell the side bar: the node under the pointer, the one selected.
  const [peek] = useState(createPeekStore);
  useLayoutEffect(() => { peek.clear(); }, [peek, focus]);
  const openSideBarAt = useCallback((selector?: string) => {
    if (!showing) setShowing(true);
    if (selector && side.view !== 'details') setSide({ view: 'details' });
    setTimeout(() => {
      const target = (selector && sideBarEl.current?.querySelector<HTMLElement>(selector)) || sideBarEl.current;
      target?.focus();
      target?.scrollIntoView?.({ block: 'nearest' });
    }, 0);
  }, [showing, setShowing, side.view, setSide]);

  // How the graph is drawn, and the wiki card's open state and width, are one setting for the
  // session, whatever the tab or page (LA-V93-R72): moving through the stage never changes them.
  const { graph: settings, setGraph, card, setCard } = useSessionSettings();
  const [sheet, setSheet] = useState(false);
  const cardButton = useRef<HTMLButtonElement>(null);
  const cardShown = narrow ? sheet : card.open;
  const setCardShown = useCallback((show: boolean) => {
    if (narrow) setSheet(show); else setCard({ open: show });
    announce(show ? 'Wiki card shown' : 'Wiki card collapsed');
    if (!show) setTimeout(() => cardButton.current?.focus(), 0);
  }, [narrow, setCard, announce]);
  const collapseCard = useCallback(() => setCardShown(false), [setCardShown]);
  // Made once per width, so the memoized card draws again only for a new page.
  const cardHandle = useMemo(() => (
    <CardHandle width={card.width} onWidth={(width) => setCard({ width })} onReset={() => setCard({ width: null })} onCollapse={collapseCard} />
  ), [card.width, setCard, collapseCard]);
  useEffect(() => { setSheet(false); }, [narrow]);

  // What the page shows, for Claude's app_focus tool in the desktop chat (LA-PLT-UC19-R06).
  const selectedNow = useCallback(() => peek.get().selected, [peek]);
  useViewState({ focus, stage, selected: null, wikiCard: cardShown }, selectedNow);

  const [graphInfo, setGraphInfo] = useState<GraphInfo | null>(null);
  const onGraph = useCallback((info: GraphInfo) => setGraphInfo(info), []);
  const [counts, setCounts] = useState('');

  // A link keeps the stage asked for.
  const asked = tab.state.stage;
  const hrefFor = useCallback((id: string) => withStage(addressOf(id), asked), [asked]);
  const onNavigate = useCallback((id: string) => navigate(hrefFor(id)), [hrefFor]);

  // The wiki card follows the focus once it settles, and draws only then.
  const resting = useSettled(focus, CARD_SETTLE_MS);
  // A page the index no longer holds (another space's, or one just removed) is never drawn: the card takes the focus at once.
  const settledFocus = index.byId.has(resting) || isGroup(index, resting) ? resting : focus;
  const cardRoute = useCardRoute(index, settledFocus, route);

  // The card's scroll is the tab's: it comes back when the tab is active again. Within a tab, a new
  // page starts at the top, and Back and Forward come back to where that history entry was scrolled
  // (noted in the entry), set before paint so the page is never drawn at the wrong place (UX-R08).
  const cardScroll = useRef<HTMLDivElement>(null);
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const shown = useRef<{ key: string; page: string } | null>(null);
  useLayoutEffect(() => {
    // Until the card settles on the focus (a page just opened, or a tab just switched to), it still
    // shows the page before, at that page's scroll; the scroll is the new page's once it is drawn.
    if (settledFocus !== focus) return;
    const before = shown.current;
    shown.current = { key: tab.key, page: settledFocus };
    const el = cardScroll.current;
    if (!el) return;
    let top = tabs.scrollOf(tabRef.current);
    if (before && before.key === tab.key && before.page !== settledFocus) {
      const noted = entryState<number>(CARD_SCROLL);
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
  }, [tab.key, focus, settledFocus, cardShown, tabs.scrollOf, tabs.setScroll]);
  // The entry notes the card's scroll as it changes (after a pause) and as a new page is opened from it.
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteScroll = useCallback(() => {
    if (noteTimer.current) { clearTimeout(noteTimer.current); noteTimer.current = null; }
    if (cardScroll.current) noteInEntry(CARD_SCROLL, Math.round(cardScroll.current.scrollTop));
  }, []);
  useEffect(() => onLeaveEntry(noteScroll), [noteScroll]);
  useEffect(() => () => { if (noteTimer.current) clearTimeout(noteTimer.current); }, []);
  const onCardScroll = useCallback(() => {
    if (!cardScroll.current) return;
    tabs.setScroll(tabRef.current, cardScroll.current.scrollTop);
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(noteScroll, 200);
  }, [tabs.setScroll, noteScroll]);

  // The open space the floating panels leave over the stage, where it frames the focus.
  const [space] = useState(createOpenSpaceStore);
  const stageEl = useRef<HTMLDivElement>(null);
  useOpenSpaceMeasure(stageEl, space, layout);

  // Commands.
  useCommand('stageGraph', () => setStage('graph'));
  useCommand('stageErd', () => setStage('erd'));
  useCommand('stageTrace', () => setStage('trace'));
  useCommand('toggleWikiCard', () => setCardShown(!cardShown));
  useCommand('toggleSideBar', () => setShowing(!showing));
  useCommand('focusSideBar', () => openSideBarAt());
  useCommand('showReferences', () => openSideBarAt('.links-in-heading'), index.byId.has(focus));
  useCommand('expandAll', () => { expandAllOnPage(true); announce('Expanded every row'); });
  useCommand('collapseAll', () => { expandAllOnPage(false); announce('Collapsed every row'); });
  // Tabs.
  useCommand('keepTab', () => { tabs.keep(tab.key); announce('Tab kept open'); });
  useCommand('closeTab', () => { tabs.close(tab.key); announce(tabs.set.tabs.length > 1 ? 'Tab closed' : 'The last tab stays open, as a preview'); });
  useCommand('nextTab', () => tabs.cycle(1), tabs.set.tabs.length > 1);
  useCommand('previousTab', () => tabs.cycle(-1), tabs.set.tabs.length > 1);

  const content: Record<StageName, ReactNode> = {
    graph: (
      <Suspense fallback={<p className="hint graph-loading">Loading the graph…</p>}>
        <GraphView index={index} focus={focus} onNavigate={onNavigate} settings={settings} onSettingsChange={setGraph} onGraph={onGraph} onPeek={peek.set} onCounts={setCounts} space={space} />
      </Suspense>
    ),
    erd: (
      <Suspense fallback={<p className="hint graph-loading">Loading the ERD…</p>}>
        <ErdView index={index} focus={focus} onNavigate={onNavigate} onPeek={peek.set} onCounts={setCounts} space={space} />
      </Suspense>
    ),
    trace: (
      <Suspense fallback={<p className="hint graph-loading">Loading the trace…</p>}>
        <TraceView index={index} focus={focus} onNavigate={onNavigate} hrefFor={hrefFor} onPeek={peek.set} onCounts={setCounts} space={space} />
      </Suspense>
    ),
  };
  const stageBox = (
    <div ref={stageEl} className="focus-stage" data-stage={stage} aria-label={`${STAGE_LABELS[stage]} stage`} role="region">
      {content[stage]}
    </div>
  );

  const sideBar = (asDrawer: boolean) => (
    <SideBar
      ref={sideBarEl}
      index={index}
      focus={focus}
      mode={stage}
      view={side.view}
      onView={setSideView}
      graph={stage === 'graph' ? graphInfo : null}
      peek={peek}
      card={cardScroll}
      cardOpen={cardShown}
      onNavigate={onNavigate}
      hrefFor={hrefFor}
      onClose={() => setShowing(false)}
      drawer={asDrawer}
    />
  );

  if (narrow) {
    return (
      <PhoneLayout
        index={index}
        tabs={tabs}
        stage={stage}
        onStage={setStage}
        stageBox={stageBox}
        strip={<HeaderStrip index={index} focus={focus} counts={counts} />}
        card={cardShown ? <WikiCard ref={cardScroll} index={index} route={cardRoute} onScroll={onCardScroll} onCollapse={collapseCard} sheet /> : null}
        onCard={setCardShown}
        cardButton={cardButton}
        sideBarShown={showing}
        onSideBar={setShowing}
        sideBarButton={sideBarButton}
        sideBar={sideBar(true)}
        sideBarRef={sideBarEl}
        layout={layout}
      />
    );
  }

  return (
    <div
      ref={layout}
      className={`stage-layout${showing ? ' with-side-bar' : ''}${cardShown ? ' with-wiki' : ''}`}
      style={{ '--side-bar-width': `${sideBarWidth}px`, ...(card.width !== null ? { '--card-width': `${card.width}px` } : {}) } as CSSProperties}
    >
      <PageBar
        index={index}
        tabs={tabs}
        stage={stage}
        onStage={setStage}
        compact={false}
        cardShown={cardShown}
        onCard={setCardShown}
        cardButton={cardButton}
        sideBarShown={showing}
        onSideBar={setShowing}
        sideBarButton={sideBarButton}
      />
      <div id={TAB_PANEL_ID} role="tabpanel" aria-labelledby={tab.key ? tabId(tab.key) : undefined} className="tab-body">
        <HeaderStrip index={index} focus={focus} counts={counts} />
        {cardShown && (
          <WikiCard
            ref={cardScroll}
            index={index}
            route={cardRoute}
            onScroll={onCardScroll}
            onCollapse={collapseCard}
            handle={cardHandle}
          />
        )}
        {stageBox}
      </div>
      {showing && (
        <div className="side-bar-column" data-floating="right">
          <ResizeHandle
            className="side-bar-handle"
            label="Resize the side bar"
            side="after"
            value={sideBarWidth}
            min={260}
            max={640}
            step={16}
            bigStep={64}
            valueAt={(x) => (layout.current?.getBoundingClientRect().right ?? x) - x - 8}
            onChange={setSideBarWidth}
            onReset={resetSideBarWidth}
            collapseBelow={160}
            onCollapse={() => setShowing(false)}
          />
          {sideBar(false)}
        </div>
      )}
    </div>
  );
}

/** The route of the page the wiki card shows: the settled focus's, or the address's own once they agree. */
function useCardRoute(index: SpecIndex, settled: string, route: FocusRoute): FocusRoute {
  const [last, setLast] = useState<{ focus: string; route: FocusRoute }>({ focus: focusOf(route), route });
  if (focusOf(route) === settled && (last.focus !== settled || last.route !== route)) {
    setLast({ focus: settled, route });
    return route;
  }
  if (last.focus === settled) return last.route;
  const parsed = parseSpecRoute(addressOf(settled), index);
  return isFocusRoute(parsed) ? parsed : route;
}

/** The handle at the wiki card's right edge: drag or arrow keys for its width, double-click to reset, drag small to collapse. */
function CardHandle({ width, onWidth, onReset, onCollapse }: { width: number | null; onWidth: (w: number) => void; onReset: () => void; onCollapse: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const cardLeft = () => ref.current?.closest('.wiki-panel')?.getBoundingClientRect().left ?? 0;
  const value = width ?? Math.max(CARD_MIN, Math.round(ref.current?.closest('.wiki-panel')?.getBoundingClientRect().width ?? CARD_MIN));
  return (
    <div ref={ref} className="wiki-panel-handle">
      <ResizeHandle
        label="Resize the wiki card"
        value={value}
        min={CARD_MIN}
        max={CARD_MAX}
        step={16}
        bigStep={64}
        valueAt={(x) => x - cardLeft()}
        onChange={onWidth}
        onReset={onReset}
        collapseBelow={200}
        onCollapse={onCollapse}
      />
    </div>
  );
}

// ---------- The phone layout ----------

interface PhoneLayoutProps {
  index: SpecIndex;
  tabs: PageTabsApi;
  stage: StageName;
  onStage: (stage: StageName) => void;
  stageBox: ReactNode;
  /** The header strip, under the compact page bar. */
  strip: ReactNode;
  /** The wiki card, while its sheet is open. */
  card: ReactNode;
  onCard: (show: boolean) => void;
  cardButton: RefObject<HTMLButtonElement | null>;
  sideBarShown: boolean;
  onSideBar: (show: boolean) => void;
  sideBarButton: RefObject<HTMLButtonElement | null>;
  sideBar: ReactNode;
  sideBarRef: RefObject<HTMLElement | null>;
  layout: RefObject<HTMLDivElement | null>;
}

/**
 * On a phone (notes/mobile-design.md) the stage stays full screen under the shell's top bar and the
 * compact page bar: the open pages as a sheet, the stage switch, the wiki card as a bottom sheet and
 * the side bar as a drawer from the right.
 */
function PhoneLayout(props: PhoneLayoutProps) {
  const { index, tabs, stage, onStage, stageBox, strip, card, onCard, cardButton, sideBarShown, onSideBar, sideBarButton, sideBar, sideBarRef, layout } = props;
  const [pagesOpen, setPagesOpen] = useState(false);
  const pagesButton = useRef<HTMLButtonElement>(null);
  const pagesSheet = useRef<HTMLUListElement>(null);
  const drawerBox = useRef<HTMLDivElement>(null);
  const count = tabs.set.tabs.length;
  const closePages = useCallback(() => { setPagesOpen(false); setTimeout(() => pagesButton.current?.focus(), 0); }, []);
  useEffect(() => { if (pagesOpen) pagesSheet.current?.querySelector<HTMLElement>('[aria-current], button')?.focus(); }, [pagesOpen]);
  // The side bar drawer takes focus as it opens; closing it gives focus back to its button.
  useEffect(() => { if (sideBarShown) sideBarRef.current?.focus(); }, [sideBarShown, sideBarRef]);
  const page = tabs.active.page;
  useEffect(() => { setPagesOpen(false); }, [page]);

  return (
    <div ref={layout} className="stage-layout is-phone">
      <PageBar
        index={index}
        tabs={tabs}
        stage={stage}
        onStage={onStage}
        compact
        cardShown={card !== null}
        onCard={onCard}
        cardButton={cardButton}
        sideBarShown={sideBarShown}
        onSideBar={onSideBar}
        sideBarButton={sideBarButton}
        pagesOpen={pagesOpen}
        onPages={() => setPagesOpen(true)}
        pagesButton={pagesButton}
      />
      {strip}
      {stageBox}
      {card && (
        <BottomSheet label="Wiki card" className="wiki-panel-sheet" onClose={() => onCard(false)}>
          {card}
        </BottomSheet>
      )}
      {sideBarShown && (
        <>
          <div className="drawer-backdrop" onMouseDown={() => onSideBar(false)} />
          <div
            ref={drawerBox}
            className="side-bar-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Side bar"
            onKeyDown={(e) => {
              if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); onSideBar(false); return; }
              trapTab(e, drawerBox.current);
            }}
          >
            {sideBar}
          </div>
        </>
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
