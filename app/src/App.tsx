import { ResizeHandle } from './components/ResizeHandle';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { navigate, useLocation } from './router';
import { formatPath, parseSpecRoute, useSpec, type SpecState } from './specs/data';
import { SpecView } from './specs/SpecPages';
import { FormatPages, isFormatRoute } from './format/FormatPages';
import { postWrite, WriterProvider, type Writer } from './edit/write';
import { CommandsProvider, useAnnounce, useCommand } from './shell/commands';
import { SPACE_KEYS, spaceCommandId } from './shell/keymap';
import { Nav } from './shell/Nav';
import { DesktopTitleBar } from './shell/DesktopTitleBar';
import { SpacesProvider, useSpaceState, type SpacesApi } from './shell/spaces';
import { pageHeading, QuickFindSheet, TopBar } from './shell/MobileBar';
import { useThemeColor } from './shell/themeColor';
import { isBool, usePanelSize, usePref } from './shell/prefs';
import { useNarrow } from './shell/useNarrow';
import { FocusPage } from './views/FocusPage';
import { ChatPanel } from './chat/ChatPanel';
import { useAppRequests } from './chat/appRequests';
import { useSessionSettings } from './graph/settings';
import { desktopBridge } from './shell/desktopChrome';
import { checksPathOf, HOME_PATH, isFocusRoute } from './views/address';
import { ThemeProvider } from './theme/ThemeProvider';
import { APPEARANCE_PATH, ThemeCommands } from './theme/ThemeCommands';
// The first load ships only the wiki (LA-PAT-APP-UX-R11): the theme editor loads when first opened,
// as the graph and the ERD view do (views/FocusPage.tsx).
const AppearancePage = lazy(() => import('./theme/AppearancePage').then((m) => ({ default: m.AppearancePage })));

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
  const isAppearance = path === APPEARANCE_PATH;
  const announce = useAnnounce();

  // The nav: collapsed to a rail (remembered), or a drawer on a narrow screen.
  const narrow = useNarrow();
  const [collapsed, setCollapsed] = usePref<boolean>(NAV_KEY, false, isBool);
  const [navWidth, setNavWidth, resetNavWidth] = usePanelSize(NAV_WIDTH.key, NAV_WIDTH.fallback, NAV_WIDTH.min, NAV_WIDTH.max);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const findRef = useRef<HTMLInputElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { setDrawerOpen(false); }, [path, narrow]);
  const closeDrawer = useCallback(() => { setDrawerOpen(false); setTimeout(() => menuButton.current?.focus(), 0); }, []);
  // An opened drawer takes focus (the quick find); closing it gives focus back to the menu button.
  useEffect(() => { if (narrow && drawerOpen) setTimeout(() => findRef.current?.focus(), 0); }, [narrow, drawerOpen]);
  const showNav = useCallback(() => {
    if (narrow) setDrawerOpen(true);
    else if (collapsed) setCollapsed(false);
  }, [narrow, collapsed, setCollapsed]);
  const spaces = useSpaceState(spec.index, path, search);
  // Every page inside a space, and the nav, read the current space's index, never the whole workspace.
  const spaceSpec = useMemo((): SpecState => ({ ...spec, index: spaces.index }), [spec, spaces.index]);

  useCommand('toggleNav', () => {
    if (narrow) { if (drawerOpen) closeDrawer(); else setDrawerOpen(true); announce(drawerOpen ? 'Navigation closed' : 'Navigation opened'); return; }
    setCollapsed(!collapsed);
    announce(collapsed ? 'Navigation expanded' : 'Navigation collapsed');
  });
  // On a phone quick find is a full-screen sheet of its own, opened from the top bar.
  const [findOpen, setFindOpen] = useState(false);
  useEffect(() => { setFindOpen(false); }, [path, narrow]);
  useCommand('quickOpen', () => {
    if (narrow) { setDrawerOpen(false); setFindOpen(true); return; }
    showNav(); setTimeout(() => findRef.current?.focus(), 0);
  });
  useThemeColor();
  useCommand('focusNav', () => {
    showNav();
    setTimeout(() => (navRef.current?.querySelector<HTMLElement>('[aria-current="page"]') ?? findRef.current)?.focus(), 0);
  });
  useCommand('goBack', () => window.history.back());
  useCommand('goForward', () => window.history.forward());
  const space = spaces.current?.id ?? null;
  useCommand('openChecks', () => { if (space) navigate(checksPathOf(space)); }, !!space);
  useCommand('goChecks', () => { if (space) navigate(checksPathOf(space)); }, !!space);
  useCommand('goFormat', () => navigate(formatPath));
  useCommand('goHome', () => navigate(HOME_PATH));
  useCommand('goToDefinition', () => {
    const link = (document.activeElement as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
    const href = link?.getAttribute('href');
    if (href && href.startsWith('/')) navigate(href);
    else announce('Focus a link first, then press F12 to open its record.');
  });
  // The chat panel (LA-PLT-UC19): desktop only, never on a phone. Its open state and width are the session's setting.
  const chatBridge = narrow ? null : desktopBridge()?.chat ?? null;
  const { chat, setChat } = useSessionSettings();
  const chatShown = !!chatBridge && chat.open;
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
    else if (narrow) setFindOpen(true);
    else { showNav(); setTimeout(() => findRef.current?.focus(), 0); }
  });

  const focusRoute = isFocusRoute(specRoute) ? specRoute : null;

  let page;
  if (isAppearance) {
    page = <Suspense fallback={<LoadingPage />}><AppearancePage /></Suspense>;
  } else if (isFormatRoute(specRoute)) {
    page = <FormatPages spec={spaceSpec} route={specRoute} />;
  } else if (focusRoute) {
    page = <FocusPage spec={spaceSpec} route={focusRoute} search={search} />;
  } else if (specRoute) {
    page = <SpecView spec={spec} space={spaces.index} route={specRoute} />;
  } else {
    // A lowercase address that is no page (`/settings/…` other than Appearance).
    page = <SpecView spec={spec} space={spaces.index} route={{ page: 'missing' }} />;
  }

  return (
    <WriterProvider value={writer}>
    <SpacesProvider value={spaces}>
    <SpaceCommands spaces={spaces} />
    <DesktopTitleBar index={spaces.index} />
    <div
      className={`app${collapsed && !narrow ? ' nav-collapsed' : ''}${narrow ? ' is-narrow' : ''}${chatShown ? ' with-chat' : ''}`}
      style={{ '--nav-width': `${navWidth}px`, ...(chat.width !== null ? { '--chat-width': `${chat.width}px` } : {}) } as CSSProperties}
      data-specs={spec.index ? 'ready' : spec.error ? 'error' : 'loading'}
    >
      <a href="#main" className="skip-link">Skip to the page</a>
      {narrow && (
        <TopBar
          ref={menuButton}
          heading={pageHeading(spaces.index, path, search)}
          navOpen={drawerOpen}
          onMenu={() => setDrawerOpen(true)}
          onFind={() => setFindOpen(true)}
        />
      )}
      {narrow && findOpen && <QuickFindSheet index={spaces.index} onClose={() => setFindOpen(false)} />}
      {narrow && drawerOpen && <div className="drawer-backdrop" onMouseDown={closeDrawer} />}
      {(!narrow || drawerOpen) && (
        <Nav
          ref={navRef}
          spec={spaceSpec}
          path={path}
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed(!collapsed)}
          drawer={narrow}
          drawerOpen={drawerOpen}
          onCloseDrawer={closeDrawer}
          findRef={findRef}
        />
      )}
      {!narrow && (
        <ResizeHandle
          className="app-nav-handle"
          label="Resize the navigation"
          value={collapsed ? NAV_WIDTH.min : navWidth}
          min={NAV_WIDTH.min}
          max={NAV_WIDTH.max}
          step={16}
          bigStep={64}
          valueAt={(x) => x - (navRef.current?.getBoundingClientRect().left ?? 0)}
          onChange={(w) => { setNavWidth(w); if (collapsed) setCollapsed(false); }}
          onReset={() => { resetNavWidth(); setCollapsed(false); }}
          collapseBelow={NAV_WIDTH.collapseBelow}
          onCollapse={() => { if (!collapsed) setCollapsed(true); }}
        />
      )}
      {page}
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
    </SpacesProvider>
    </WriterProvider>
  );
}

/** What shows in the page's place while its code loads. */
function LoadingPage() {
  return <main className="placeholder panel" id="main"><p>Loading…</p></main>;
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

/** F8 and Shift+F8: move focus to the next or previous problem on the page, and say what it is. */
function stepProblem(step: 1 | -1, announce: (text: string) => void) {
  const items = [...document.querySelectorAll<HTMLElement>('#main li.problem')];
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

