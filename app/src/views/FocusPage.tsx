// The focus page of a record or group at its address, /<id> (LA-V96): the stage and the panels floating over it.
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { Icon } from '../components/icons';
import { ResizeHandle } from '../components/ResizeHandle';
import { expandAllOnPage } from '../components/TreeList';
import { CARD_MAX, CARD_MIN, DEFAULT_GRAPH_SETTINGS } from '../exploring/session-settings/model';
import { useSessionSettings } from '../exploring/session-settings/use-session-settings';
import { chooseGraphLayout } from '../exploring/session-settings/commands/choose-graph-layout';
import { showOrHideMinimap } from '../exploring/session-settings/commands/show-or-hide-minimap';
import { showOrHideAllLinks } from '../exploring/session-settings/commands/show-or-hide-all-links';
import { resizeWikiCard } from '../exploring/session-settings/commands/resize-wiki-card';
import type { GraphSettings } from '../graph/GraphPage';
import { isGroup } from '../graph/model';
import { Link, navigate, onLeaveEntry } from '../router';
import { useAnnounce, useCommand } from '../shell/commands';
import { BottomSheet } from '../shell/BottomSheet';
import { useNarrow } from '../shell/useNarrow';
import { parseSpecRoute } from './spec-route';
import { type RecordIndex } from '../exploring/record-summaries/record-index';
import { type DataState } from '../exploring/record-summaries/reads';
import { NotFound } from '../specs/SpecPages';
import { addressOf, HOME_PATH, focusOf, isFocusRoute, pathOf, STAGE_LABELS, stageFromSearch, withStage, type FocusRoute, type StageName } from './address';
import { HeaderStrip } from './HeaderStrip';
import { createOpenSpaceStore, usePageRoom, useOpenSpaceMeasure, useRoom } from './openSpace';
import { PageActions, PageBar, STAGE_COMMANDS } from './PageBar';
import { createPeekStore } from './peek';
import { TAB_PANEL_ID, tabId, tabLabel } from './TabStrip';
import { rememberedStage, useNewPlaceOpener, usePlace, withStageIn, type TabsApi } from './usePlace';
import { hereOf, type PlaceView } from './place';
import { DEFAULT_TRACE_VIEW } from '../trace/views';
import { runTabSetCommand } from '../exploring/tab-set/run';
import { rememberStage } from '../exploring/tab-set/commands/remember-stage';
import { takeMenuRecord } from '../shell/desktopRecord';
import { usePreview } from './preview';
import { WikiCard } from './WikiCard';
import { Button } from '../components/Button';
import { useViewState } from '../chat/appRequests';
import { parseFormatPage } from '../format/reference';
import { overlaysOf, pageHref } from './overlays';
import { useChanges } from '../changes/changes';
import { useLiveVersion } from '../changes/marks';
import { useJumpChanges } from '../changes/jump';

// One page for one thing (a record, a group, a product or a domain), at one address. One stage
// fills the window behind everything: the Graph, the ERD (of a domain, an aggregate or an entity's
// aggregate, or of the domain or product around any other record) or the Trace (an obligation's chain, the
// matrix of the obligations under the focus, or the rows that hold it), switched in the page bar and named
// in the address (`?stage=erd`). Everything else floats over it as frosted panels: the nav (the
// shell's), the tab panel (the page bar, then the header strip naming the focus), the wiki card (the
// focus's wiki page, its History at the end of the whole page). The stage frames
// its focus in the open space the panels leave (openSpace.ts), and every part follows one focus:
// a click on the stage, a link in the card, Back and Forward all move the place it shows.
//
// The page shows one place (usePlace.ts): on the web the browser tab's, in the desktop app the active tab's (useTabs.ts),
// each with its own stage, focus, camera, depth, filters, wiki card and history. How the graph is laid out, the
// minimap and the wiki card's width are the window's, not a place's (exploring/session-settings).

const GraphView = lazy(() => import('../graph/GraphPage').then((m) => ({ default: m.GraphView })));
const ErdView = lazy(() => import('../erd/ErdView').then((m) => ({ default: m.ErdView })));
const TraceView = lazy(() => import('../trace/TraceView').then((m) => ({ default: m.TraceView })));

/**
 * How long the focus must rest before the wiki card draws its page, in ms. A focus that moves after
 * a rest draws at once; moves that follow each other closer than this (arrowing through the stage)
 * draw only the one they settle on, so the card never draws a page per step.
 */
export const CARD_SETTLE_MS = 180;

// ---------- The page ----------

export function FocusPage({ spec, route, search }: { spec: DataState; route: FocusRoute; search: string }) {
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

function invalid(index: RecordIndex, route: FocusRoute): ReactNode | null {
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

/** The route and query of the place's address; the window's own while the place's is not a focus page's. */
function useShownRoute(index: RecordIndex, address: string, addressRoute: FocusRoute, addressSearch: string): { route: FocusRoute; search: string } {
  return useMemo(() => {
    const q = address.indexOf('?');
    const path = q < 0 ? address : address.slice(0, q);
    const search = q < 0 ? '' : address.slice(q);
    if (path === pathOf(addressRoute)) return { route: addressRoute, search };
    const parsed = parseSpecRoute(path, index);
    return isFocusRoute(parsed) ? { route: parsed, search } : { route: addressRoute, search: addressSearch };
  }, [index, address, addressRoute, addressSearch]);
}

function Focused({ index, route: addressRoute, search: addressSearch }: { index: RecordIndex; route: FocusRoute; search: string }) {
  // The place shown: the browser tab's on the web, the active tab's in the desktop app, whose address the window's follows.
  const place = usePlace(index, addressRoute, addressSearch);
  const { route, search } = useShownRoute(index, place.address, addressRoute, addressSearch);
  const tabs = place.tabs;
  const focus = focusOf(route);
  // What the stage and the wiki card show: the focus, or the record quick find previews (preview.ts). The address,
  // the tabs and the header strip stay on the focus; when the preview ends the stage glides back.
  const previewed = usePreview();
  const preview = previewed !== null && previewed !== focus && (index.byId.has(previewed) || isGroup(index, previewed)) ? previewed : null;
  const shownFocus = preview ?? focus;
  const previewing = useRef(false);
  previewing.current = preview !== null;
  const announce = useAnnounce();
  const narrow = useNarrow();

  // The stage is the place's, named in its address: the one a link named, otherwise the one the place was on. Every
  // stage works on every focus (LA-PAT-APP-UX-R17), so the switch never hides or disables one.
  const { stage } = place;

  const setStage = useCallback((next: StageName) => {
    if (next === stage) return;
    // A phone's switch leaves the stage remembered for a wide screen alone.
    if (!narrow) runTabSetCommand(rememberStage, { stage: next });
    navigate(withStageIn(place.address, next), true);
    announce(`${STAGE_LABELS[next]} stage`);
  }, [stage, narrow, place.address, announce]);
  // The stage a link names becomes the one remembered, for the first tab of a new session.
  const linked = stageFromSearch(search);
  useEffect(() => { if (linked && !narrow) runTabSetCommand(rememberStage, { stage: linked }); }, [linked, narrow]);
  // Focus lost with the stage it was on (a key switched the stage) lands on the new stage's button
  // in the switch. On a first load focus stays at the start, where Tab finds the skip link.
  const shownStage = useRef(stage);
  useEffect(() => {
    if (shownStage.current === stage) return;
    shownStage.current = stage;
    const active = document.activeElement;
    if (active && active !== document.body && active.isConnected) return;
    document.querySelector<HTMLElement>(`.page-bar-actions [data-command="${STAGE_COMMANDS[stage]}"]`)?.focus();
  }, [stage]);

  const layout = useRef<HTMLDivElement>(null);
  // Panels never crowd the page (LA-PAT-APP-UX-R18): the wiki card collapses for space first; the Reader's
  // choice stays as set, and one they open while it is collapsed is held open.
  const { crowded, hold } = useRoom();
  // What the stages tell the page: the node under the pointer, the one selected (for the chat's app_focus).
  const [peek] = useState(createPeekStore);
  useLayoutEffect(() => { peek.clear(); }, [peek, focus]);

  // How the graph is laid out, the minimap and the wiki card's width are the window's, whatever the place; the depth,
  // the kind filters and the card's open and expanded state are the place's (LA-V93-R72): moving through the stage
  // never changes either.
  const { graph: look, card } = useSessionSettings();
  const { view, setView } = place;
  const filters = useMemo(() => ({ hiddenKinds: new Set(view.hiddenKinds) }), [view.hiddenKinds]);
  const settings = useMemo<GraphSettings>(() => ({ ...look, depth: view.depth, filters }), [look, view.depth, filters]);
  const onSettings = useCallback((next: GraphSettings) => {
    chooseGraphLayout({ layout: next.layout });
    showOrHideMinimap({ shown: next.minimap });
    showOrHideAllLinks({ shown: next.allLinks });
    setView((v) => {
      const kinds = [...next.filters.hiddenKinds];
      const same = next.depth === v.depth && kinds.length === v.hiddenKinds.length && kinds.every((k) => v.hiddenKinds.includes(k));
      return same ? v : { ...v, depth: next.depth, hiddenKinds: kinds };
    });
  }, [setView]);
  // The Trace's view is the place's: each tab its own (LA-V98).
  const setTraceView = useCallback((trace: PlaceView['trace']) => setView((v) => (v.trace === trace ? v : { ...v, trace })), [setView]);
  const setCardView = useCallback((patch: Partial<PlaceView['card']>) => setView((v) => (
    Object.entries(patch).every(([k, x]) => v.card[k as keyof PlaceView['card']] === x) ? v : { ...v, card: { ...v.card, ...patch } }
  )), [setView]);
  const [sheet, setSheet] = useState(false);
  const cardButton = useRef<HTMLButtonElement>(null);
  // A format page opened over the focus (`?page=format/…`) shows in the card, open whatever the card's setting.
  const formatPage = overlaysOf(search).page;
  const format = useMemo(() => parseFormatPage(formatPage), [formatPage]);
  const cardOpen = view.card.open || format !== null;
  useEffect(() => { if (format && !narrow) hold('card', true); }, [format, narrow, hold]);
  const cardCrowded = !narrow && cardOpen && crowded.has('card');
  const cardShown = narrow ? sheet || format !== null : cardOpen && !cardCrowded;
  usePageRoom(cardOpen);
  // Collapsed from inside the card (its own button or handle, or a key pressed with focus in it), focus goes to the page
  // bar's toggle (LA-V61-R42); collapsed by a key from the stage, it stays where it was. Collapsing it closes a format
  // page in it too.
  const setCardShown = useCallback((show: boolean, fromInside = false) => {
    const inside = fromInside || document.activeElement?.closest('.wiki-panel, .wiki-panel-sheet') != null;
    if (!show && format) navigate(pageHref(null));
    if (narrow) setSheet(show); else { setCardView({ open: show }); hold('card', show); }
    announce(show ? 'Wiki card shown' : 'Wiki card collapsed');
    if (!show && inside) setTimeout(() => cardButton.current?.focus(), 0);
  }, [narrow, setCardView, hold, announce, format]);
  const collapseCard = useCallback(() => setCardShown(false, true), [setCardShown]);
  const expandCard = useCallback((expanded: boolean) => setCardView({ expanded }), [setCardView]);
  // A preview shows in the card's compact summary, whatever the place's setting, which it leaves alone.
  const cardExpanded = preview === null && view.card.expanded;
  // Made once per width, so the memoized card draws again only for a new page.
  const cardHandle = useMemo(() => (
    <CardHandle width={card.width} onWidth={(width) => resizeWikiCard({ width })} onReset={() => resizeWikiCard({ width: null })} onCollapse={collapseCard} />
  ), [card.width, collapseCard]);
  useEffect(() => { setSheet(false); }, [narrow]);

  // What the page shows, for Claude's app_focus tool in the desktop chat (LA-PLT-UC19-R06).
  const selectedNow = useCallback(() => peek.get().selected, [peek]);
  useViewState({ focus, stage, selected: null, wikiCard: cardShown }, selectedNow);

  const [counts, setCounts] = useState('');

  // A link keeps the stage the place is on.
  const hrefFor = useCallback((id: string) => withStage(addressOf(id), stage), [stage]);
  const onNavigate = useCallback((id: string) => navigate(hrefFor(id)), [hrefFor]);
  // Cmd or Ctrl+click, or a middle-click, on a box opens it in a new place: a tab, or a browser tab on the web.
  const { openNew } = place;
  const onOpenNew = useCallback((id: string, background: boolean) => openNew(hrefFor(id), background), [openNew, hrefFor]);
  useNewPlaceOpener(openNew);

  // The wiki card follows the focus (or the preview) once it settles, and draws only then.
  const resting = useSettled(shownFocus, CARD_SETTLE_MS);
  // A page the index no longer holds (another space's, or one just removed) is never drawn: the card takes the focus at once.
  const settledFocus = index.byId.has(resting) || isGroup(index, resting) ? resting : shownFocus;
  const cardRoute = useCardRoute(index, settledFocus, route);

  // The card's scroll is the place's, noted in each entry of its history: a page just opened starts at the top, and a
  // place shown again (Back, Forward, another tab activated) comes back to where its entry was scrolled, set before
  // paint so the page is never drawn at the wrong place (UX-R08).
  const cardScroll = useRef<HTMLDivElement>(null);
  const { scroll: placeScroll, setScroll: setPlaceScroll } = place;
  useLayoutEffect(() => {
    // A format page in the card sets its own scroll; closing it brings back the focus's page where it was.
    if (format) return;
    // A preview starts at its top and leaves the place's scroll as it was, for the card to come back to.
    if (preview !== null) { if (settledFocus === preview && cardScroll.current) cardScroll.current.scrollTop = 0; return; }
    // Until the card settles on the focus (a page just opened, or a tab just switched to), it still
    // shows the page before, at that page's scroll; the scroll is the new page's once it is drawn.
    if (settledFocus !== focus) return;
    const el = cardScroll.current;
    if (!el) return;
    const top = placeScroll();
    el.scrollTop = top;
    // Parts of the page may still settle their size before the first paint (a section's actions
    // slot, a list measuring its rows), so the scroll is set again once layout is done, still
    // before that paint: a ResizeObserver reports after layout and before paint, once on observe.
    if (top <= 0 || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => { el.scrollTop = top; observer.disconnect(); });
    for (const child of el.children) observer.observe(child);
    return () => observer.disconnect();
  }, [place.key, place.address, focus, preview, settledFocus, cardShown, format, placeScroll]);
  // The place notes the card's scroll as it changes (after a pause) and as a new page is opened from it.
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteScroll = useCallback(() => {
    if (noteTimer.current) { clearTimeout(noteTimer.current); noteTimer.current = null; }
    // While a preview shows, the page's own scroll stays as noted.
    if (!previewing.current && !format && cardScroll.current) setPlaceScroll(cardScroll.current.scrollTop);
  }, [setPlaceScroll, format]);
  useEffect(() => onLeaveEntry(noteScroll), [noteScroll]);
  useEffect(() => () => { if (noteTimer.current) clearTimeout(noteTimer.current); }, []);
  const onCardScroll = useCallback(() => {
    if (!cardScroll.current || previewing.current || format) return;
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(noteScroll, 200);
  }, [noteScroll, format]);

  // The open space the floating panels leave over the stage, where it frames the focus.
  const [space] = useState(createOpenSpaceStore);
  const stageEl = useRef<HTMLDivElement>(null);
  useOpenSpaceMeasure(stageEl, space, layout);

  // Commands.
  useCommand('stageGraph', () => setStage('graph'));
  useCommand('stageErd', () => setStage('erd'));
  useCommand('stageTrace', () => setStage('trace'));
  useCommand('toggleWikiCard', () => setCardShown(!cardShown));
  useCommand('collapseWikiCard', () => setCardShown(false), cardShown);
  // Shift+F12: the wiki card's whole page, with focus on what links to the record.
  useCommand('showReferences', () => {
    if (!cardShown) setCardShown(true);
    if (!view.card.expanded) setCardView({ expanded: true });
    setTimeout(() => {
      const heading = document.querySelector<HTMLElement>('.wiki-panel .links-in-heading');
      heading?.focus();
      heading?.scrollIntoView?.({ block: 'nearest' });
    }, 0);
  }, index.byId.has(focus));
  useCommand('expandAll', () => { expandAllOnPage(true); announce('Expanded every row'); });
  useCommand('collapseAll', () => { expandAllOnPage(false); announce('Collapsed every row'); });
  // The desktop app's tabs; on the web the browser's own tabs do all of this.
  const many = !!tabs && tabs.set.tabs.length > 1;
  useCommand('newTab', () => { tabs?.openHome(); announce('New tab'); }, !!tabs);
  useCommand('closeTab', () => {
    if (!tabs?.set.active) return;
    tabs.close(tabs.set.active);
    announce(many ? 'Tab closed' : 'Tab closed: a new tab at the product');
  }, !!tabs);
  useCommand('duplicateTab', () => { tabs?.duplicate(); announce('Tab duplicated'); }, !!tabs);
  useCommand('nextTab', () => tabs?.cycle(1), many);
  useCommand('previousTab', () => tabs?.cycle(-1), many);
  useCommand('openRecordInNewTab', () => { const id = takeMenuRecord(); if (id) openNew(hrefFor(id)); }, !!tabs);

  useFollow(focus, onNavigate, stageEl);
  useJumpChanges(index, focus, onNavigate);

  const content: Record<StageName, ReactNode> = {
    graph: (
      <Suspense fallback={<p className="hint graph-loading">Loading the graph…</p>}>
        <GraphView index={index} focus={shownFocus} onNavigate={onNavigate} settings={settings} onSettingsChange={onSettings} onPeek={peek.set} onCounts={setCounts} space={space} cameraKey={place.key} onOpenNew={onOpenNew} />
      </Suspense>
    ),
    erd: (
      <Suspense fallback={<p className="hint graph-loading">Loading the ERD…</p>}>
        <ErdView index={index} focus={shownFocus} onNavigate={onNavigate} onPeek={peek.set} onCounts={setCounts} space={space} cameraKey={place.key} onOpenNew={onOpenNew} />
      </Suspense>
    ),
    trace: (
      <Suspense fallback={<p className="hint graph-loading">Loading the trace…</p>}>
        <TraceView index={index} focus={shownFocus} onNavigate={onNavigate} hrefFor={hrefFor} onPeek={peek.set} onCounts={setCounts} space={space} cameraKey={place.key} onOpenNew={onOpenNew} view={view.trace} onView={setTraceView} />
      </Suspense>
    ),
  };
  const stageBox = (
    <div ref={stageEl} className="focus-stage" data-stage={stage} aria-label={`${STAGE_LABELS[stage]} stage`} role="region">
      {content[stage]}
    </div>
  );

  const actionProps = { cardShown, cardCrowded, onCard: setCardShown, cardButton };

  if (narrow) {
    return (
      <PhoneLayout
        index={index}
        tabs={tabs}
        stage={stage}
        onStage={setStage}
        stageBox={stageBox}
        strip={<HeaderStrip index={index} focus={focus} counts={counts} />}
        card={cardShown ? <WikiCard ref={cardScroll} index={index} route={cardRoute} onScroll={onCardScroll} onCollapse={collapseCard} expanded={cardExpanded} onExpanded={expandCard} format={format} sheet /> : null}
        onCard={setCardShown}
        cardButton={cardButton}
        layout={layout}
      />
    );
  }

  return (
    <div
      ref={layout}
      className={`stage-layout${cardShown ? ' with-wiki' : ''}${tabs ? '' : ' one-place'}`}
      style={(card.width !== null ? { '--card-width': `${card.width}px` } : {}) as CSSProperties}
    >
      {/* The desktop app's tab row; on the web the browser's tabs are the places, and the controls join the header strip's row. */}
      {tabs && <PageBar index={index} tabs={tabs} stage={stage} onStage={setStage} compact={false} {...actionProps} />}
      <div id={TAB_PANEL_ID} role={tabs ? 'tabpanel' : undefined} aria-labelledby={tabs?.set.active ? tabId(tabs.set.active) : undefined} className="tab-body">
        <HeaderStrip index={index} focus={focus} counts={counts} actions={tabs ? undefined : <PageActions stage={stage} onStage={setStage} compact={false} {...actionProps} />} />
        {cardShown && (
          <WikiCard
            ref={cardScroll}
            index={index}
            route={cardRoute}
            onScroll={onCardScroll}
            onCollapse={collapseCard}
            expanded={cardExpanded}
            onExpanded={expandCard}
            handle={cardHandle}
            format={format}
          />
        )}
        {stageBox}
      </div>
    </div>
  );
}

const ignore = () => {};

/**
 * Follow (LA-EXP-UC15): while it is on, the focus moves to each change as it lands, the newest, and the camera glides
 * there as for any focus. The Reader's own move turns it off, with a note saying so: a focus Follow did not make, or a
 * drag, a pinch or the wheel on the stage.
 */
function useFollow(focus: string, onNavigate: (id: string) => void, stageEl: RefObject<HTMLDivElement | null>) {
  const { follow, setFollow, live, product } = useChanges();
  const version = useLiveVersion();
  /** The focus Follow moved to, and the newest change it has followed. */
  const went = useRef<string | null>(null);
  const seen = useRef(0);
  useEffect(() => {
    if (!follow) { went.current = null; seen.current = performance.now(); return; }
    const newest = live.all().filter((m) => m.product === product && m.change !== 'removed' && m.t > seen.current).sort((a, b) => b.t - a.t)[0];
    if (!newest) return;
    seen.current = newest.t;
    if (newest.id === focus) return;
    went.current = newest.id;
    onNavigate(newest.id);
  }, [follow, version, live, product]);
  const shown = useRef(focus);
  useEffect(() => {
    const was = shown.current;
    shown.current = focus;
    if (!follow || was === focus || focus === went.current) return;
    setFollow(false, 'Follow is off: you moved the focus.');
  }, [focus, follow, setFollow]);
  useEffect(() => {
    const el = stageEl.current;
    if (!el || !follow) return;
    const moved = () => setFollow(false, 'Follow is off: you moved the camera.');
    const pressed = (e: PointerEvent) => { if ((e.target as Element | null)?.closest?.('canvas, .graph-controls')) moved(); };
    el.addEventListener('wheel', moved, { passive: true });
    el.addEventListener('pointerdown', pressed);
    return () => { el.removeEventListener('wheel', moved); el.removeEventListener('pointerdown', pressed); };
  }, [follow, setFollow, stageEl]);
}

/**
 * The stage behind the products picker (LA-V97): the last product's stage, on the stage last used, dimmed and out of
 * reach under the picker; or, with no product to show (a first launch), an empty map.
 */
export function StageBackdrop({ index, focus }: { index: RecordIndex | null; focus: string | null }) {
  const [space] = useState(createOpenSpaceStore);
  const stageEl = useRef<HTMLDivElement>(null);
  const layout = useRef<HTMLDivElement>(null);
  useOpenSpaceMeasure(stageEl, space, layout);
  const { graph: look } = useSessionSettings();
  const settings = useMemo(() => ({ ...DEFAULT_GRAPH_SETTINGS, ...look }), [look]);
  const [peek] = useState(createPeekStore);
  const stage = rememberedStage();
  const shown = index && focus && index.byId.has(focus) ? focus : null;
  let content: ReactNode = null;
  if (index && shown) {
    const fallback = <p className="hint graph-loading">Loading the stage…</p>;
    content = (
      <Suspense fallback={fallback}>
        {stage === 'graph' && <GraphView index={index} focus={shown} onNavigate={ignore} settings={settings} onSettingsChange={ignore} onPeek={peek.set} onCounts={ignore} space={space} />}
        {stage === 'erd' && <ErdView index={index} focus={shown} onNavigate={ignore} onPeek={peek.set} onCounts={ignore} space={space} />}
        {stage === 'trace' && <TraceView index={index} focus={shown} onNavigate={ignore} hrefFor={addressOf} onPeek={peek.set} onCounts={ignore} space={space} view={DEFAULT_TRACE_VIEW} onView={ignore} />}
      </Suspense>
    );
  }
  return (
    <div ref={layout} className="stage-layout is-backdrop" inert aria-hidden="true">
      <div ref={stageEl} className="focus-stage" data-stage={stage}>{content}</div>
    </div>
  );
}

/** The route of the page the wiki card shows: the settled focus's, or the address's own once they agree. */
function useCardRoute(index: RecordIndex, settled: string, route: FocusRoute): FocusRoute {
  const [last, setLast] = useState<{ focus: string; route: FocusRoute }>({ focus: focusOf(route), route });
  if (focusOf(route) === settled && (last.focus !== settled || last.route !== route)) {
    setLast({ focus: settled, route });
    return route;
  }
  if (last.focus === settled) return last.route;
  const parsed = parseSpecRoute(addressOf(settled), index);
  return isFocusRoute(parsed) ? parsed : route;
}

/** The handle at the wiki card's left edge: drag or arrow keys for its width (Left grows it, as the card sits after it), double-click to reset, drag small to collapse. */
function CardHandle({ width, onWidth, onReset, onCollapse }: { width: number | null; onWidth: (w: number) => void; onReset: () => void; onCollapse: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const cardRight = () => ref.current?.closest('.wiki-panel')?.getBoundingClientRect().right ?? 0;
  const value = width ?? Math.max(CARD_MIN, Math.round(ref.current?.closest('.wiki-panel')?.getBoundingClientRect().width ?? CARD_MIN));
  return (
    <div ref={ref} className="wiki-panel-handle">
      <ResizeHandle
        label="Resize the wiki card"
        side="after"
        value={value}
        min={CARD_MIN}
        max={CARD_MAX}
        step={16}
        bigStep={64}
        valueAt={(x) => cardRight() - x}
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
  index: RecordIndex;
  /** The desktop app's tabs, shown as the Open pages sheet; null on the web. */
  tabs: TabsApi | null;
  stage: StageName;
  onStage: (stage: StageName) => void;
  stageBox: ReactNode;
  /** The header strip, under the compact page bar. */
  strip: ReactNode;
  /** The wiki card, while its sheet is open. */
  card: ReactNode;
  onCard: (show: boolean) => void;
  cardButton: RefObject<HTMLButtonElement | null>;
  layout: RefObject<HTMLDivElement | null>;
}

/**
 * On a phone (notes/mobile-design.md) the stage stays full screen under the shell's top bar and the
 * compact page bar: the stage switch and the wiki card as a bottom sheet, and in the desktop app the open tabs as a sheet.
 */
function PhoneLayout(props: PhoneLayoutProps) {
  const { index, tabs, stage, onStage, stageBox, strip, card, onCard, cardButton, layout } = props;
  const [pagesOpen, setPagesOpen] = useState(false);
  const pagesButton = useRef<HTMLButtonElement>(null);
  const pagesSheet = useRef<HTMLUListElement>(null);
  const count = tabs?.set.tabs.length ?? 0;
  const closePages = useCallback(() => { setPagesOpen(false); setTimeout(() => pagesButton.current?.focus(), 0); }, []);
  useEffect(() => { if (pagesOpen) pagesSheet.current?.querySelector<HTMLElement>('[aria-current], button')?.focus(); }, [pagesOpen]);
  // The wiki card's sheet takes focus as it opens; closing it gives focus back to its toggle (setCardShown).
  const cardOpen = card !== null;
  useEffect(() => {
    if (cardOpen) setTimeout(() => document.querySelector<HTMLElement>('.wiki-panel-sheet .wiki-panel-head button, .wiki-panel-sheet button')?.focus(), 0);
  }, [cardOpen]);
  const active = tabs?.set.active;
  useEffect(() => { setPagesOpen(false); }, [active]);

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
        pagesOpen={pagesOpen}
        onPages={tabs ? () => setPagesOpen(true) : undefined}
        pagesButton={pagesButton}
      />
      {strip}
      {stageBox}
      {card && (
        <BottomSheet label="Wiki card" className="wiki-panel-sheet" onClose={() => onCard(false)}>
          {card}
        </BottomSheet>
      )}
      {pagesOpen && tabs && (
        <BottomSheet label="Open pages" className="pages-sheet" onClose={closePages}>
          <div className="sheet-head">
            <h2 className="sheet-title">Open pages <span className="section-count">{count}</span></h2>
            <Button variant="icon" label="Close the open pages" onClick={closePages}><Icon name="x" /></Button>
          </div>
          <ul ref={pagesSheet} className="pages-list" aria-label="Open pages">
            {tabs.set.tabs.map((t) => {
              const { id, title } = tabLabel(index, hereOf(t.place).address);
              const current = t.key === tabs.set.active;
              const name = id ? `${id} ${title}` : title;
              return (
                <li key={t.key} className={`pages-row${current ? ' is-active' : ''}`}>
                  <button
                    type="button"
                    className="pages-open"
                    aria-current={current ? 'page' : undefined}
                    aria-label={name}
                    onClick={() => { tabs.activate(t.key); closePages(); }}
                  >
                    {id && <span className="tab-id">{id}</span>}
                    <span className="tab-title">{title}</span>
                  </button>
                  <Button variant="icon" label={`Close ${name}`} onClick={() => tabs.close(t.key)}>
                    <Icon name="x" size={16} />
                  </Button>
                </li>
              );
            })}
          </ul>
        </BottomSheet>
      )}
    </div>
  );
}
