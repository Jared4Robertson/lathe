import { ResizeHandle } from './components/ResizeHandle';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { navigate, setCarry, setPatchBase, useLocation } from './router';
import { parseSpecRoute, useSpec, type SpecState } from './specs/data';
import { formatPath } from './format/reference';
import { SpecView } from './specs/SpecPages';
import { postWrite, WriterProvider, type Writer } from './edit/write';
import { CommandsProvider, useAnnounce, useCommand } from './shell/commands';
import { SPACE_KEYS, spaceCommandId } from './shell/keymap';
import { Nav } from './shell/Nav';
import { DesktopTitleBar } from './shell/DesktopTitleBar';
import { SpacesProvider, useSpaceState, type SpacesApi } from './shell/spaces';
import { pageHeading, TopBar } from './shell/MobileBar';
import { QuickOpen } from './shell/QuickOpen';
import { useThemeColor } from './shell/themeColor';
import { isBool, usePanelSize, usePref } from './shell/prefs';
import { useNarrow } from './shell/useNarrow';
import { FocusPage, StageBackdrop } from './views/FocusPage';
import { ChecksPanel } from './views/ChecksPanel';
import { ProductsPicker } from './views/ProductsPicker';
import { carryOverlays, overlaysOf, panelHref, useEscapeClosesTopmost, type ToolPanel } from './views/overlays';
import { ChatPanel } from './chat/ChatPanel';
import { useAppRequests } from './chat/appRequests';
import { CARD_MIN, CHAT_DEFAULT, useSessionSettings } from './graph/settings';
import { CARD_GAP, CARD_GAP_Y, crowdedLabel, RoomContext, STAGE_MIN, useRoomState } from './views/openSpace';
import { desktopBridge } from './shell/desktopChrome';
import { addressOf, focusOf, HOME_PATH, isFocusRoute } from './views/address';
import { ThemeProvider } from './theme/ThemeProvider';
import { ThemeCommands } from './theme/ThemeCommands';
// The first load ships only the wiki (LA-PAT-APP-UX-R11): Appearance and the theme editor load when first opened,
// as the graph and the ERD view do (views/FocusPage.tsx).
const AppearancePopover = lazy(() => import('./theme/Appearance').then((m) => ({ default: m.AppearancePopover })));
const ThemeEditorPanel = lazy(() => import('./theme/Appearance').then((m) => ({ default: m.ThemeEditorPanel })));

// A move to another focus keeps the tool open over the stage (views/overlays.ts).
setCarry(carryOverlays);

/** The width of each tool over the stage, right of the nav, in px: what the open space leaves room for (openSpace.ts). */
const TOOL_WIDTHS: Record<ToolPanel, number> = { checks: 380, appearance: 360, theme: 600 };

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

const NAV_KEY = 'lathe:nav-collapsed';
/** The nav's width (the space rail and the panel), its limits, and below what a drag collapses it to the rail. */
const NAV_WIDTH = { key: 'lathe:nav-width', fallback: 336, min: 256, max: 560, collapseBelow: 180 };
/** The nav collapsed to its rail, in px. */
const NAV_RAIL = 56;

/** The app shell: the nav, the page for the address, and the commands that work everywhere. */
function Shell() {
  const { path, search } = useLocation();
  const spec = useSpec();
  const { reload } = spec;
  // Writes go through the server's command layer; the data is read again after one goes through.
  const writer = useMemo<Writer>(() => ({
    write: async (commands) => {
      const answer = await postWrite(commands);
      if (answer.ok) await reload();
      return answer;
    },
  }), [reload]);
  const specRoute = parseSpecRoute(path, spec.index);
  // The tools open over the stage (views/overlays.ts): a panel, and a format page in the wiki card. None on the picker.
  const isHome = specRoute.page === 'specs';
  const overlays = overlaysOf(search);
  const tool = isHome ? null : overlays.panel;
  const announce = useAnnounce();

  // The nav: collapsed to a rail (remembered), or a drawer on a narrow screen.
  const narrow = useNarrow();
  const [collapsed, setCollapsed] = usePref<boolean>(NAV_KEY, false, isBool);
  const [navWidth, setNavWidth, resetNavWidth] = usePanelSize(NAV_WIDTH.key, NAV_WIDTH.fallback, NAV_WIDTH.min, NAV_WIDTH.max);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { setDrawerOpen(false); }, [path, narrow]);
  const closeDrawer = useCallback(() => { setDrawerOpen(false); setTimeout(() => menuButton.current?.focus(), 0); }, []);
  // An opened drawer takes focus (its Go to button); closing it gives focus back to the menu button.
  useEffect(() => { if (narrow && drawerOpen) setTimeout(() => navRef.current?.querySelector<HTMLElement>('.quick-find-button')?.focus(), 0); }, [narrow, drawerOpen]);
  // The chat panel (LA-PLT-UC19): desktop only, never on a phone. Its open state and width are the session's setting.
  const chatBridge = narrow ? null : desktopBridge()?.chat ?? null;
  const { chat, setChat } = useSessionSettings();
  const chatShown = !!chatBridge && chat.open;
  // Panels never crowd the page (LA-PAT-APP-UX-R18): the nav collapses to its rail for space last,
  // after the page's wiki card; the Reader's own choice (`collapsed`) stays as set.
  const room = useRoomState({ nav: { open: !collapsed, width: navWidth, rail: NAV_RAIL }, chat: chatShown ? chat.width ?? CHAT_DEFAULT : null, tool: tool ? TOOL_WIDTHS[tool] : null }, narrow);
  const { hold } = room;
  const navCrowded = room.crowded.has('nav');
  const navCollapsed = collapsed || navCrowded;
  /** Opens or collapses the nav as the Reader asks; one opened while collapsed for space is held open. */
  const setNavOpen = useCallback((open: boolean) => {
    setCollapsed(!open);
    hold('nav', open);
  }, [setCollapsed, hold]);
  const showNav = useCallback(() => {
    if (narrow) setDrawerOpen(true);
    else if (navCollapsed) setNavOpen(true);
  }, [narrow, navCollapsed, setNavOpen]);
  const spaces = useSpaceState(spec.index, path, search);
  // Every page inside a space, and the nav, read the current space's index, never the whole workspace.
  const spaceSpec = useMemo((): SpecState => ({ ...spec, index: spaces.index }), [spec, spaces.index]);

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
  useCommand('goBack', () => window.history.back());
  useCommand('goForward', () => window.history.forward());
  const space = spaces.current?.id ?? null;
  useCommand('openChecks', () => navigate(panelHref('checks')), !!space);
  useCommand('goChecks', () => navigate(panelHref('checks')), !!space);
  useCommand('goFormat', () => navigate(formatPath));
  useCommand('goHome', () => navigate(HOME_PATH));
  useCommand('goToDefinition', () => {
    const link = (document.activeElement as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
    const href = link?.getAttribute('href');
    if (href && href.startsWith('/')) navigate(href);
    else announce('Focus a link first, then press F12 to open its record.');
  });
  const chatInput = useRef<HTMLTextAreaElement>(null);
  const chatPanel = () => document.getElementById('chat-panel');
  useCommand('toggleChat', () => {
    // Open: focus the message box; open with focus elsewhere: focus it; with focus in it: hide it.
    if (chatShown && chatPanel()?.contains(document.activeElement)) { setChat({ open: false }); announce('Chat hidden'); return; }
    if (!chatShown) { setChat({ open: true }); announce('Chat shown'); }
    setTimeout(() => chatInput.current?.focus(), 0);
  }, !!chatBridge);
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
  useEscapeClosesTopmost(search, leaveHome);
  const closeTool = useCallback(() => navigate(panelHref(null)), []);

  let page;
  if (focusRoute) {
    page = <FocusPage spec={spaceSpec} route={focusRoute} search={search} />;
  } else if (isHome) {
    // While the specs load, the empty map shows where the stage will be.
    page = (
      <main className="stage-page home-page" id="main">
        {spec.error && <p className="error">Couldn't load the specs: {spec.error}</p>}
        <StageBackdrop index={spaces.index} focus={backdropRoute && isFocusRoute(backdropRoute) ? focusOf(backdropRoute) : null} />
      </main>
    );
  } else {
    page = <SpecView spec={spec} />;
  }

  const product = spaces.current && spaces.index ? spaces.index.byId.get(spaces.current.id) : undefined;
  let toolPanel = null;
  if (tool === 'checks' && spaces.index && product) {
    toolPanel = <ChecksPanel index={spaces.index} product={product} focus={focusRoute ? focusOf(focusRoute) : null} sheet={narrow} onClose={closeTool} />;
  } else if (tool === 'appearance') {
    toolPanel = <Suspense fallback={null}><AppearancePopover sheet={narrow} onClose={closeTool} /></Suspense>;
  } else if (tool === 'theme') {
    toolPanel = <Suspense fallback={null}><ThemeEditorPanel id={overlays.theme} sheet={narrow} onClose={closeTool} /></Suspense>;
  }

  return (
    <WriterProvider value={writer}>
    <SpacesProvider value={spaces}>
    <RoomContext.Provider value={room}>
    <SpaceCommands spaces={spaces} />
    <DesktopTitleBar index={spaces.index} />
    <div
      className={`app${navCollapsed && !narrow ? ' nav-collapsed' : ''}${narrow ? ' is-narrow' : ''}${chatShown ? ' with-chat' : ''}`}
      style={{
        '--nav-width': `${navWidth}px`, '--rail-width': `${NAV_RAIL}px`, '--card-min': `${CARD_MIN}px`, '--stage-min': `${STAGE_MIN}px`, '--card-gap': `${CARD_GAP}px`, '--card-gap-y': `${CARD_GAP_Y}px`,
        ...(chat.width !== null ? { '--chat-width': `${chat.width}px` } : {}),
        ...(tool && !narrow ? { '--tool-space': `${TOOL_WIDTHS[tool] + 8}px` } : {}),
      } as CSSProperties}
      data-crowded={room.crowded.size > 0 ? [...room.crowded].join(' ') : undefined}
      data-specs={spec.index ? 'ready' : spec.error ? 'error' : 'loading'}
    >
      <a href="#main" className="skip-link">Skip to the page</a>
      {narrow && (
        <TopBar
          ref={menuButton}
          heading={pageHeading(spaces.index, path, search)}
          navOpen={drawerOpen}
          onMenu={() => setDrawerOpen(true)}
          onFind={() => openQuick('')}
        />
      )}
      {quick && <QuickOpen index={spaces.index} seed={quick} onClose={closeQuick} />}
      {narrow && drawerOpen && <div className="drawer-backdrop" onMouseDown={closeDrawer} />}
      {(!narrow || drawerOpen) && (
        <Nav
          ref={navRef}
          spec={spaceSpec}
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
          value={navCollapsed ? NAV_WIDTH.min : navWidth}
          min={NAV_WIDTH.min}
          max={NAV_WIDTH.max}
          step={16}
          bigStep={64}
          valueAt={(x) => x - (navRef.current?.getBoundingClientRect().left ?? 0)}
          onChange={(w) => { setNavWidth(w); if (navCollapsed) setNavOpen(true); }}
          onReset={() => { resetNavWidth(); setNavOpen(true); }}
          collapseBelow={NAV_WIDTH.collapseBelow}
          onCollapse={() => { if (!navCollapsed) setNavOpen(false); }}
        />
      )}
      {page}
      {isHome && spec.index && <ProductsPicker index={spec.index} onClose={leaveHome} />}
      {toolPanel}
      {chatShown && chatBridge && (
        <ChatPanel
          bridge={chatBridge}
          index={spec.index}
          width={chat.width}
          onWidth={(width) => setChat({ width })}
          onClose={() => { setChat({ open: false }); announce('Chat hidden'); }}
          input={chatInput}
        />
      )}
    </div>
    </RoomContext.Provider>
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

