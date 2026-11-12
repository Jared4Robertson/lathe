import { ResizeHandle } from './components/ResizeHandle';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { browserHistory, navigate, setCarry, setPatchBase, useLocation } from './router';
import { parseSpecRoute } from './views/spec-route';
import { useDataState, useDataVersion } from './exploring/record-summaries/reads';
import { formatPath } from './format/reference';
import { SpecView } from './specs/SpecPages';
import { postCommand, WriterProvider, type Writer } from './edit/write';
import { useReadOnly } from './edit/access';
import { CommandsProvider, useAnnounce, useCommand, useShortcutHint } from './shell/commands';
import { SPACE_KEYS, spaceCommandId } from './shell/keymap';
import { Nav } from './shell/Nav';
import { DesktopTitleBar } from './shell/DesktopTitleBar';
import { SpacesProvider, useSpaceState, type SpacesApi } from './shell/spaces';
import { pageHeading, TopBar } from './shell/MobileBar';
import { QuickOpen } from './shell/QuickOpen';
import { useThemeColor } from './shell/themeColor';
import { useAggregate } from './shell/prefs';
import { PANEL_LIMITS } from './platform/panel/model';
import { panelRepository } from './platform/panel/repository';
import { resizePanel } from './platform/panel/commands/resize-panel';
import { showOrHidePanel } from './platform/panel/commands/show-or-hide-panel';
import { useNarrow } from './shell/useNarrow';
import { FocusPage, StageBackdrop } from './views/FocusPage';
import { ChecksPanel } from './views/ChecksPanel';
import { ChangesPanel } from './changes/ChangesPanel';
import { ChangesProvider } from './changes/ChangesProvider';
import { ProductsPicker } from './views/ProductsPicker';
import { carryOverlays, overlaysOf, panelHref, useEscapeClosesTopmost } from './views/overlays';
import { useWindowVoice, VoiceContext } from './chat/voice/useVoice';
import { pointedAt, useAppRequests } from './chat/appRequests';
import { chatChips } from './chat/chips';
import { takeMenuRecord } from './shell/desktopRecord';
import { CARD_MIN, CHAT_DEFAULT } from './exploring/session-settings/model';
import { useSessionSettings } from './exploring/session-settings/use-session-settings';
import { resizeChat } from './exploring/session-settings/commands/resize-chat';
import { CARD_GAP, CARD_GAP_Y, crowdedLabel, RoomContext, STAGE_MIN, useRoomState, toolWidthOf } from './views/openSpace';
import { desktopBridge } from './shell/desktopChrome';
import { addressOf, focusOf, HOME_PATH, isFocusRoute } from './views/address';
import { ThemeProvider } from './theme/ThemeProvider';
import { ThemeCommands } from './theme/ThemeCommands';
// The first load ships only the wiki (LA-PAT-APP-UX-R11): Appearance and the theme editor load when first opened,
// as the graph and the ERD view do (views/FocusPage.tsx).
const AppearancePopover = lazy(() => import('./theme/Appearance').then((m) => ({ default: m.AppearancePopover })));
const DashboardPanel = lazy(() => import('./traceability/dashboard/DashboardPanel').then((m) => ({ default: m.DashboardPanel })));
const ThemeEditorPanel = lazy(() => import('./theme/Appearance').then((m) => ({ default: m.ThemeEditorPanel })));
// The chat panel is the desktop's alone (LA-PLT-UC19): a browser never loads its code, and the desktop loads it when the chat first shows.
const ChatPanel = lazy(() => import('./chat/ChatPanel').then((m) => ({ default: m.ChatPanel })));

// A move to another focus keeps the tool open over the stage (views/overlays.ts).
setCarry(carryOverlays);

/** The width of each tool over the stage, right of the nav, in px: what the open space leaves room for (openSpace.ts). */

export default function App() {
  return (
    <CommandsProvider>
      <ThemeProvider>
        <ThemeCommands />
        <Shell />
      </ThemeProvider>
    </CommandsProvider>
  );
}

/** The nav collapsed to its rail, in px. */
const NAV_RAIL = 56;

/** The app shell: the nav, the page for the address, and the commands that work everywhere. */
function Shell() {
  const { path, search } = useLocation();
  // The data's version: every read follows it, and a write that went through or a change to the files moves it on.
  const dataVersion = useDataVersion();
  const { reload, mark } = dataVersion;
  // Writes go through the aggregates' commands; after one goes through, the reads of the read models it changed read again.
  const writer = useMemo<Writer>(() => ({
    command: async (route, input) => {
      const before = mark();
      const answer = await postCommand(route, input);
      if (answer.ok) await reload({ mark: before, tables: answer.tables });
      return answer;
    },
  }), [reload, mark]);
  // Another device on the network only reads (LA-PLT-UC23-R05): it gets no writer, so no editor shows its actions.
  const readOnly = useReadOnly();
  const spaces = useSpaceState(dataVersion.version, path, search);
  // Every page inside a space, and the nav, read the current space's own reads, never another product's.
  const spec = useDataState(spaces.current?.id ?? null, dataVersion);
  const specRoute = parseSpecRoute(path, spec.index);
  // The tools open over the stage (views/overlays.ts): a panel, and a format page in the wiki card. None on the picker.
  const isHome = specRoute.page === 'specs';
  const overlays = overlaysOf(search);
  const tool = isHome ? null : overlays.panel;
  const toolWidth = toolWidthOf(tool);
  const announce = useAnnounce();
  const definitionKey = useShortcutHint('goToDefinition');

  // The nav: collapsed to a rail (remembered), or a drawer on a narrow screen.
  const narrow = useNarrow();
  const { nav: { collapsed, width: navWidth }, chat: { collapsed: chatCollapsed } } = useAggregate(panelRepository);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  // Choosing a page or a tool (Checks, Changes, Appearance: a tool opens under the drawer) closes the drawer.
  useEffect(() => { setDrawerOpen(false); }, [path, narrow, tool]);
  const closeDrawer = useCallback(() => { setDrawerOpen(false); setTimeout(() => menuButton.current?.focus(), 0); }, []);
  // An opened drawer takes focus (its Go to button); closing it gives focus back to the menu button.
  useEffect(() => { if (narrow && drawerOpen) setTimeout(() => navRef.current?.querySelector<HTMLElement>('.quick-find-button')?.focus(), 0); }, [narrow, drawerOpen]);
  // The chat panel (LA-PLT-UC19): desktop only, never on a phone. Whether it shows is a Panel's (LA-PLT-UC06), kept
  // from one launch to the next; its width is the session's setting.
  const chatBridge = narrow ? null : desktopBridge()?.chat ?? null;
  const { chat } = useSessionSettings();
  const chatShown = !!chatBridge && !chatCollapsed;
  // Panels never crowd the page (LA-PAT-APP-UX-R18): the nav collapses to its rail for space last,
  // after the page's wiki card; the Reader's own choice (`collapsed`) stays as set.
  const room = useRoomState({ nav: { open: !collapsed, width: navWidth, rail: NAV_RAIL }, chat: chatShown ? chat.width ?? CHAT_DEFAULT : null, tool: toolWidth }, narrow);
  const { hold } = room;
  const navCrowded = room.crowded.has('nav');
  const navCollapsed = collapsed || navCrowded;
  /** Opens or collapses the nav as the Reader asks; one opened while collapsed for space is held open. */
  const setNavOpen = useCallback((open: boolean) => {
    showOrHidePanel({ panel: 'nav', shown: open });
    hold('nav', open);
  }, [hold]);
  const showNav = useCallback(() => {
    if (narrow) setDrawerOpen(true);
    else if (navCollapsed) setNavOpen(true);
  }, [narrow, navCollapsed, setNavOpen]);

  useCommand('toggleNav', () => {
    if (narrow) { if (drawerOpen) closeDrawer(); else setDrawerOpen(true); announce(drawerOpen ? 'Navigation closed' : 'Navigation opened'); return; }
    setNavOpen(navCollapsed);
    announce(navCollapsed ? 'Navigation expanded' : 'Navigation collapsed');
  });
  // Quick find and the command palette: one overlay (QuickOpen.tsx), on records or, after a ">", on commands.
  const [quick, setQuick] = useState<{ query: string; n: number } | null>(null);
  const openQuick = useCallback((query: string) => {
    setDrawerOpen(false);
    setQuick((q) => ({ query, n: (q?.n ?? 0) + 1 }));
  }, []);
  const closeQuick = useCallback(() => setQuick(null), []);
  useEffect(() => { setQuick(null); }, [path]);
  useCommand('quickOpen', () => openQuick(''));
  useCommand('commandPalette', () => openQuick('>'));
  useThemeColor();
  useCommand('focusNav', () => {
    showNav();
    setTimeout(() => (navRef.current?.querySelector<HTMLElement>('[aria-current="page"]') ?? navRef.current?.querySelector<HTMLElement>('.quick-find-button'))?.focus(), 0);
  });
  useCommand('goBack', () => browserHistory.back());
  useCommand('goForward', () => browserHistory.forward());
  const space = spaces.current?.id ?? null;
  useCommand('openChecks', () => navigate(panelHref('checks')), !!space);
  useCommand('goChecks', () => navigate(panelHref('checks')), !!space);
  useCommand('openDashboard', () => navigate(panelHref(overlaysOf(window.location.search).panel === 'dashboard' ? null : 'dashboard')), !!space);
  useCommand('openChanges', () => navigate(panelHref('changes')), !!space);
  useCommand('goFormat', () => navigate(formatPath));
  useCommand('goHome', () => navigate(HOME_PATH));
  useCommand('goToDefinition', () => {
    const link = (document.activeElement as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
    const href = link?.getAttribute('href');
    if (href && href.startsWith('/')) navigate(href);
    else announce(definitionKey.text ? `Focus a link first, then press ${definitionKey.text} to open its record.` : 'Focus a link first, then go to its record.');
  });
  const chatInput = useRef<HTMLTextAreaElement>(null);
  const chatPanel = () => document.getElementById('chat-panel');
  // Focuses the chat's message box once it is drawn: the first show waits for the panel's code to load.
  const focusChat = useCallback(() => {
    let tries = 0;
    const go = () => { if (chatInput.current) chatInput.current.focus(); else if (tries++ < 50) setTimeout(go, 20); };
    setTimeout(go, 0);
  }, []);
  useCommand('toggleChat', () => {
    // Open: focus the message box; open with focus elsewhere: focus it; with focus in it: hide it.
    if (chatShown && chatPanel()?.contains(document.activeElement)) { showOrHidePanel({ panel: 'chat', shown: false }); announce('Chat hidden'); return; }
    if (!chatShown) { showOrHidePanel({ panel: 'chat', shown: true }); announce('Chat shown'); }
    focusChat();
  }, !!chatBridge);
  // The chat's voice (LA-PLT-UC20): voice activation wakes the chat, hidden or not, and focuses its message box.
  const wakeChat = useCallback(() => {
    showOrHidePanel({ panel: 'chat', shown: true });
    focusChat();
  }, [focusChat]);
  const voice = useWindowVoice(chatBridge ? desktopBridge()?.voice ?? null : null, wakeChat, announce);
  useCommand('dictate', () => { wakeChat(); voice?.toggle(); }, !!voice && voice.unavailable === null);
  // Point and ask (LA-PLT-UC19-R13): the box pointed at, or the one the native menu was opened on, is attached to the message.
  const attach = (id: string | null) => {
    if (!id) { announce('Select a box or focus a record first'); return; }
    chatChips.add(id);
    wakeChat();
    announce(`Asking Claude about ${id}`);
  };
  useCommand('askClaude', () => attach(pointedAt(spec.index)), !!chatBridge);
  useCommand('askClaudeAboutRecord', () => attach(takeMenuRecord()), !!chatBridge);
  useAppRequests(spec.index, spaces.current?.id ?? null);
  useCommand('nextProblem', () => stepProblem(1, announce));
  useCommand('previousProblem', () => stepProblem(-1, announce));
  useCommand('focusSearch', () => {
    let el = document.activeElement as HTMLElement | null;
    while (el && el !== document.body) {
      const box = el.querySelector?.<HTMLInputElement>('input[type="search"]');
      if (box) { box.focus(); return; }
      el = el.parentElement;
    }
    const inPage = document.querySelector<HTMLInputElement>('#main input[type="search"]');
    if (inPage) inPage.focus();
    else openQuick('');
  });

  const focusRoute = isFocusRoute(specRoute) ? specRoute : null;
  // The products picker's stage: the last product the Reader was in, where they left it, or an empty map on a first launch.
  const backdrop = spaces.last ? (spaces.lastPage(spaces.last.id) ?? addressOf(spaces.last.id)) : null;
  const backdropPath = backdrop?.split('?')[0] ?? null;
  const backdropRoute = backdropPath ? parseSpecRoute(backdropPath, spec.index) : null;
  // A tool opened from the picker opens over the stage behind it.
  const backdropRef = useRef(backdropPath);
  backdropRef.current = backdropPath;
  useEffect(() => { setPatchBase(() => (window.location.pathname === HOME_PATH && backdropRef.current) || window.location.pathname); }, []);
  const leaveHome = isHome && backdrop ? () => navigate(backdrop) : null;
  useEscapeClosesTopmost(leaveHome);
  const closeTool = useCallback(() => navigate(panelHref(null)), []);

  let page;
  if (focusRoute) {
    page = <FocusPage spec={spec} route={focusRoute} search={search} />;
  } else if (isHome) {
    // While the specs load, the empty map shows where the stage will be.
    page = (
      <main className="stage-page home-page" id="main">
        {spec.error && <p className="error">Couldn't load the specs: {spec.error}</p>}
        <StageBackdrop index={spec.index} focus={backdropRoute && isFocusRoute(backdropRoute) ? focusOf(backdropRoute) : null} />
      </main>
    );
  } else {
    page = <SpecView spec={spec} />;
  }

  const product = spaces.current && spec.index ? spec.index.byId.get(spaces.current.id) : undefined;
  let toolPanel = null;
  if (tool === 'checks' && spec.index && product) {
    toolPanel = <ChecksPanel index={spec.index} product={product} focus={focusRoute ? focusOf(focusRoute) : null} sheet={narrow} onClose={closeTool} />;
  } else if (tool === 'changes' && spec.index && product) {
    toolPanel = <ChangesPanel index={spec.index} focus={focusRoute ? focusOf(focusRoute) : null} sheet={narrow} onClose={closeTool} />;
  } else if (tool === 'dashboard' && spec.index && product) {
    toolPanel = <Suspense fallback={null}><DashboardPanel index={spec.index} product={product} sheet={narrow} onClose={closeTool} /></Suspense>;
  } else if (tool === 'appearance') {
    toolPanel = <Suspense fallback={null}><AppearancePopover sheet={narrow} onClose={closeTool} /></Suspense>;
  } else if (tool === 'theme') {
    toolPanel = <Suspense fallback={null}><ThemeEditorPanel id={overlays.theme} sheet={narrow} onClose={closeTool} /></Suspense>;
  }

  return (
    <WriterProvider value={readOnly ? null : writer}>
    <SpacesProvider value={spaces}>
    <ChangesProvider index={spec.index} product={spaces.current?.id ?? null}>
    <RoomContext.Provider value={room}>
    <SpaceCommands spaces={spaces} />
    <DesktopTitleBar index={spec.index} />
    <div
      className={`app${desktopBridge() ? ' has-tabs' : ''}${navCollapsed && !narrow ? ' nav-collapsed' : ''}${narrow ? ' is-narrow' : ''}${chatShown ? ' with-chat' : ''}`}
      style={{
        '--nav-width': `${navWidth}px`, '--rail-width': `${NAV_RAIL}px`, '--card-min': `${CARD_MIN}px`, '--stage-min': `${STAGE_MIN}px`, '--card-gap': `${CARD_GAP}px`, '--card-gap-y': `${CARD_GAP_Y}px`,
        ...(chat.width !== null ? { '--chat-width': `${chat.width}px` } : {}),
        ...(toolWidth !== null && !narrow ? { '--tool-space': `${toolWidth + 8}px` } : {}),
      } as CSSProperties}
      data-crowded={room.crowded.size > 0 ? [...room.crowded].join(' ') : undefined}
      data-specs={spec.error ? 'error' : spaces.read && (!spaces.current || spec.index) ? 'ready' : 'loading'}
    >
      <a href="#main" className="skip-link">Skip to the page</a>
      {narrow && (
        <TopBar
          ref={menuButton}
          heading={pageHeading(spec.index, path, search)}
          navOpen={drawerOpen}
          onMenu={() => setDrawerOpen(true)}
          onFind={() => openQuick('')}
        />
      )}
      {quick && <QuickOpen index={spec.index} seed={quick} onClose={closeQuick} />}
      {narrow && drawerOpen && <div className="drawer-backdrop" onMouseDown={closeDrawer} />}
      {(!narrow || drawerOpen) && (
        <Nav
          ref={navRef}
          spec={spec}
          path={path}
          collapsed={navCollapsed}
          expandLabel={navCrowded ? crowdedLabel('nav') : undefined}
          onToggleCollapsed={() => setNavOpen(navCollapsed)}
          drawer={narrow}
          drawerOpen={drawerOpen}
          onCloseDrawer={closeDrawer}
        />
      )}
      {!narrow && (
        <ResizeHandle
          className="app-nav-handle"
          label="Resize the navigation"
          value={navCollapsed ? PANEL_LIMITS.nav.min : navWidth}
          min={PANEL_LIMITS.nav.min}
          max={PANEL_LIMITS.nav.max}
          step={16}
          bigStep={64}
          valueAt={(x) => x - (navRef.current?.getBoundingClientRect().left ?? 0)}
          onChange={(w) => { resizePanel({ panel: 'nav', width: w }); if (navCollapsed) setNavOpen(true); }}
          onReset={() => { resizePanel({ panel: 'nav', width: null }); setNavOpen(true); }}
          collapseBelow={PANEL_LIMITS.nav.collapseBelow}
          onCollapse={() => { if (!navCollapsed) setNavOpen(false); }}
        />
      )}
      {page}
      {isHome && <ProductsPicker version={spec.version} onClose={leaveHome} />}
      {toolPanel}
      {chatShown && chatBridge && (
        <VoiceContext.Provider value={voice}>
        <Suspense fallback={null}>
        <ChatPanel
          bridge={chatBridge}
          index={spec.index}
          product={spaces.current?.id ?? null}
          width={chat.width}
          onWidth={(width) => resizeChat({ width })}
          onClose={() => { showOrHidePanel({ panel: 'chat', shown: false }); announce('Chat hidden'); }}
          input={chatInput}
        />
        </Suspense>
        </VoiceContext.Provider>
      )}
    </div>
    </RoomContext.Provider>
    </ChangesProvider>
    </SpacesProvider>
    </WriterProvider>
  );
}

/** Alt+1 to Alt+9 (⌥1 to ⌥9 on a Mac) switch to the spaces in rail order, each a "Switch to <product>" command. */
function SpaceCommands({ spaces }: { spaces: SpacesApi }) {
  return <>{Array.from({ length: SPACE_KEYS }, (_, i) => <SpaceCommand key={i} n={i + 1} spaces={spaces} />)}</>;
}

function SpaceCommand({ n, spaces }: { n: number; spaces: SpacesApi }) {
  const announce = useAnnounce();
  const space = spaces.spaces[n - 1];
  useCommand(spaceCommandId(n), () => {
    if (!space) return;
    spaces.go(space.id);
    announce(`Switched to ${space.title}`);
  }, !!space, space ? `Switch to ${space.title}` : undefined);
  return null;
}

/** F8 and Shift+F8: move focus to the next or previous problem on the page or in the Checks panel, and say what it is. */
function stepProblem(step: 1 | -1, announce: (text: string) => void) {
  const items = [...document.querySelectorAll<HTMLElement>('#main li.problem, .tool-panel li.problem')];
  if (items.length === 0) { announce('No problems on this page.'); return; }
  const at = items.findIndex((el) => el === document.activeElement || el.contains(document.activeElement));
  const next = at < 0 ? (step === 1 ? 0 : items.length - 1) : (at + step + items.length) % items.length;
  const el = items[next];
  el.tabIndex = -1;
  el.classList.add('is-current-problem');
  items.forEach((other) => { if (other !== el) other.classList.remove('is-current-problem'); });
  el.focus();
  el.scrollIntoView?.({ block: 'nearest' });
  announce(`Problem ${next + 1} of ${items.length}: ${el.textContent?.trim() ?? ''}`);
}

