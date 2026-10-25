import { ResizeHandle } from './components/ResizeHandle';
import { lazy, Suspense, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { DiagramSummary } from './types';
import { navigate, useLocation } from './router';
import { checksPath, formatPath, parseSpecRoute, useSpec } from './specs/data';
import { SpecView } from './specs/SpecPages';
import { FormatPages, isFormatRoute } from './format/FormatPages';
import { FormatProvider, useFormatStore } from './format/reference';
import { onLatheEvent } from './events';
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
import { HOME_PATH, isFocusRoute, redirectTarget } from './views/address';
import { ThemeProvider } from './theme/ThemeProvider';
import { APPEARANCE_PATH, ThemeCommands } from './theme/ThemeCommands';
import { Button } from './components/Button';
// The first load ships only the wiki (LA-PAT-APP-UX-R11): the theme editor and the diagrams, with
// React Flow and ELK, load when first opened, as the graph and the Model view do (views/FocusPage.tsx).
const AppearancePage = lazy(() => import('./theme/AppearancePage').then((m) => ({ default: m.AppearancePage })));
const DiagramView = lazy(() => import('./diagrams/DiagramView').then((m) => ({ default: m.DiagramView })));

const DIAGRAMS_PATH = '/diagrams';
const diagramPath = (slug: string) => `${DIAGRAMS_PATH}/${slug}`;
const slugFromPath = (path: string) => path.match(/^\/diagrams\/([a-z0-9-]+)/)?.[1] ?? null;

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
const NAV_WIDTH = { key: 'lathe:nav-width', fallback: 304, min: 256, max: 560, collapseBelow: 180 };

/** The app shell: the nav, the page for the address, and the commands that work everywhere. */
function Shell() {
  const { path, search } = useLocation();
  const spec = useSpec();
  const specRoute = parseSpecRoute(path, spec.index);
  const slug = specRoute ? null : slugFromPath(path);
  const isAppearance = path === APPEARANCE_PATH;
  const format = useFormatStore();
  const announce = useAnnounce();
  const [diagrams, setDiagrams] = useState<DiagramSummary[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  // Whether the diagrams list has come back once (or failed): the nav draws its lists only then, with the specs (UX-R08).
  const [diagramsLoaded, setDiagramsLoaded] = useState(false);

  const loadDiagrams = useCallback(async () => {
    try {
      const response = await fetch('/api/diagrams');
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? response.statusText);
      setDiagrams(body);
      setListError(null);
    } catch (e) {
      setListError(e instanceof Error ? e.message : String(e));
    } finally {
      setDiagramsLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadDiagrams();
    return onLatheEvent('model:changed', loadDiagrams);
  }, [loadDiagrams]);

  // Old addresses (/records, /specs, /graph) go to the same thing at its ID, keeping the query and hash.
  const redirecting = specRoute?.page === 'redirect';
  const redirectTo = specRoute?.page === 'redirect' && specRoute.to !== null ? redirectTarget(specRoute.to, search, window.location.hash) : null;
  useEffect(() => { if (redirectTo) navigate(redirectTo, true); }, [redirectTo]);

  // Diagrams alone opens the first diagram.
  useEffect(() => {
    if (path === DIAGRAMS_PATH && diagrams.length > 0) navigate(diagramPath(diagrams[0].slug), true);
  }, [path, diagrams]);

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
  useCommand('openChecks', () => navigate(checksPath));
  useCommand('goChecks', () => navigate(checksPath));
  useCommand('goFormat', () => navigate(formatPath));
  useCommand('goDiagrams', () => navigate(diagrams[0] ? diagramPath(diagrams[0].slug) : DIAGRAMS_PATH));
  useCommand('goHome', () => navigate(HOME_PATH));
  useCommand('goToDefinition', () => {
    const link = (document.activeElement as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
    const href = link?.getAttribute('href');
    if (href && href.startsWith('/')) navigate(href);
    else announce('Focus a link first, then press F12 to open its record.');
  });
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

  const current = diagrams.find((d) => d.slug === slug);
  const focusRoute = isFocusRoute(specRoute) ? specRoute : null;
  const newDiagram = <NewDiagram onCreated={async (created) => { await loadDiagrams(); navigate(diagramPath(created.slug)); }} />;

  let page;
  if (redirecting) {
    page = <main className="placeholder panel" id="main"><p>{spec.error ? `Couldn't load the specs: ${spec.error}` : 'Opening…'}</p></main>;
  } else if (isAppearance) {
    page = <Suspense fallback={<LoadingPage />}><AppearancePage /></Suspense>;
  } else if (isFormatRoute(specRoute)) {
    page = <FormatPages spec={spec} route={specRoute} />;
  } else if (focusRoute) {
    page = <FocusPage spec={spec} route={focusRoute} search={search} />;
  } else if (specRoute) {
    page = <SpecView spec={spec} route={specRoute} />;
  } else if (current) {
    page = <Suspense fallback={<LoadingPage />}><DiagramView key={current.slug} diagram={current} /></Suspense>;
  } else if (slug || path === DIAGRAMS_PATH) {
    page = (
      <main className="placeholder panel" id="main">
        <p>{!diagramsLoaded ? 'Loading diagrams…' : slug ? `There's no diagram called "${slug}".` : 'No diagrams yet.'}</p>
      </main>
    );
  } else {
    // A lowercase address that is no page (`/settings/…` other than Appearance).
    page = <SpecView spec={spec} route={{ page: 'missing' }} />;
  }

  return (
    <FormatProvider value={format}>
    <SpacesProvider value={spaces}>
    <SpaceCommands spaces={spaces} />
    <DesktopTitleBar index={spec.index} />
    <div
      className={`app${collapsed && !narrow ? ' nav-collapsed' : ''}${narrow ? ' is-narrow' : ''}`}
      style={{ '--nav-width': `${navWidth}px` } as CSSProperties}
      data-specs={spec.index ? 'ready' : spec.error ? 'error' : 'loading'}
    >
      <a href="#main" className="skip-link">Skip to the page</a>
      {narrow && (
        <TopBar
          ref={menuButton}
          heading={pageHeading(spec.index, path, search, diagrams)}
          navOpen={drawerOpen}
          onMenu={() => setDrawerOpen(true)}
          onFind={() => setFindOpen(true)}
        />
      )}
      {narrow && findOpen && <QuickFindSheet index={spec.index} diagrams={diagrams} space={spaces.current} onClose={() => setFindOpen(false)} />}
      {narrow && drawerOpen && <div className="drawer-backdrop" onMouseDown={closeDrawer} />}
      {(!narrow || drawerOpen) && (
        <Nav
          ref={navRef}
          spec={spec}
          path={path}
          diagrams={diagrams}
          diagramError={listError}
          newDiagram={newDiagram}
          diagramsLoaded={diagramsLoaded}
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
    </div>
    </SpacesProvider>
    </FormatProvider>
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


function NewDiagram({ onCreated }: { onCreated: (d: DiagramSummary) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!open) return <Button className="new-diagram" icon="plus" onClick={() => setOpen(true)}>New diagram</Button>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError('Enter a title first.'); return; }
    setSaving(true);
    try {
      const response = await fetch('/api/diagrams', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title, description }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? response.statusText);
      setOpen(false); setTitle(''); setDescription(''); setError(null);
      onCreated(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="new-diagram-form" onSubmit={submit}>
      <label htmlFor="new-title">Title</label>
      <input id="new-title" value={title} autoFocus onChange={(e) => { setTitle(e.target.value); setError(null); }} placeholder="Making software" />
      <label htmlFor="new-description">Description <span>(optional)</span></label>
      <textarea id="new-description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      {error && <p className="error">{error}</p>}
      <div className="form-actions">
        <Button variant="primary" type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create diagram'}</Button>
        <Button onClick={() => { setOpen(false); setError(null); }}>Cancel</Button>
      </div>
    </form>
  );
}
