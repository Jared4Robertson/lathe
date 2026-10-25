import { useEffect, useLayoutEffect, useState } from 'react';
import { Button } from '../components/Button';
import { Icon } from '../components/icons';
import { useLocation } from '../router';
import { useRunCommand } from './commands';
import type { SpecIndex } from '../specs/data';
import { desktopBridge } from './desktopChrome';
import { useDesktopErrorCount, useDesktopRecordMenu } from './desktopRecord';
import { Tooltip } from './Tooltip';
import './DesktopTitleBar.css';

// The desktop app's own title bar (LA-DSK-UC04), as in VS Code: the window has no system title bar,
// so this 38 px bar on the shell color carries the window's controls (the traffic lights at the left
// on macOS, the native buttons at the right elsewhere), back and forward, a command center naming
// the page that opens quick find, and the layout toggles. It drags the window; a double-click on it
// zooms or maximizes the window, natively, as the system setting says. In full screen on macOS the
// traffic lights hide, and so does the room kept for them. In a browser it is not drawn.
// It also carries the desktop's page hooks: the Dock badge and the record menu (desktopRecord.tsx).

/** What the bar shows of the page, read from the page itself: its heading and which panels show. */
interface PageState {
  title: string;
  navShown: boolean;
  inspectorShown: boolean;
  /** Whether the page has an inspector to show or hide at all. */
  inspectorOffered: boolean;
}

function readPage(): PageState {
  const app = document.querySelector('.app');
  const narrow = app?.classList.contains('is-narrow') ?? false;
  const inspectorShown = !!document.getElementById('inspector');
  return {
    title: document.querySelector('#main h1')?.textContent?.trim() ?? '',
    navShown: narrow ? !!document.getElementById('nav') : !(app?.classList.contains('nav-collapsed') ?? false),
    inspectorShown,
    inspectorOffered: inspectorShown || !!document.querySelector('.inspector-toggle'),
  };
}

const samePage = (a: PageState, b: PageState) =>
  a.title === b.title && a.navShown === b.navShown && a.inspectorShown === b.inspectorShown && a.inspectorOffered === b.inspectorOffered;

/** The page's state, kept current as the page changes (the observer batches each turn's changes into one read). */
function usePageState(): PageState {
  const [page, setPage] = useState<PageState>({ title: '', navShown: true, inspectorShown: false, inspectorOffered: false });
  useLayoutEffect(() => {
    const read = () => {
      const next = readPage();
      setPage((prev) => (samePage(prev, next) ? prev : next));
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.getElementById('root') ?? document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return page;
}

/** The Navigation API, where the browser has it (Electron does), for whether back and forward lead anywhere. */
type HistoryNavigation = { canGoBack: boolean; canGoForward: boolean; addEventListener: (type: string, listener: () => void) => void; removeEventListener: (type: string, listener: () => void) => void };

function useHistoryEnds() {
  useLocation();
  const navigation = (window as { navigation?: HistoryNavigation }).navigation;
  const [, setVersion] = useState(0);
  useEffect(() => {
    if (!navigation) return;
    const update = () => setVersion((v) => v + 1);
    navigation.addEventListener('currententrychange', update);
    return () => navigation.removeEventListener('currententrychange', update);
  }, [navigation]);
  // Without the Navigation API there is no telling, so both stay enabled.
  return { canGoBack: navigation?.canGoBack ?? true, canGoForward: navigation?.canGoForward ?? true };
}

/** The platform's class: room for the traffic lights at the left on macOS (none in full screen, where they hide), for the window's buttons at the right elsewhere. */
const platformClass = (platform: string | undefined, fullScreen: boolean) => (platform === 'darwin' ? (fullScreen ? 'is-mac is-full-screen' : 'is-mac') : 'is-overlay');

/** Whether the window is in full screen, as the shell says. */
function useFullScreen(bridge: LatheDesktop) {
  const [fullScreen, setFullScreen] = useState(false);
  useEffect(() => bridge.onFullScreen?.(setFullScreen), [bridge]);
  return fullScreen;
}

function ArrowIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg className="icon" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {direction === 'left' ? <><path d="M5 12h14" /><path d="M5 12l6 6" /><path d="M5 12l6-6" /></> : <><path d="M5 12h14" /><path d="M13 18l6-6" /><path d="M13 6l6 6" /></>}
    </svg>
  );
}

/** The bar, drawn only in the desktop app. `index` is the product's specs, for the Dock badge and the record menu. */
export function DesktopTitleBar({ index = null }: { index?: SpecIndex | null }) {
  const bridge = desktopBridge();
  if (!bridge) return null;
  return <TitleBar bridge={bridge} index={index} />;
}

function TitleBar({ bridge, index }: { bridge: LatheDesktop; index: SpecIndex | null }) {
  const platform = bridge.platform;
  const fullScreen = useFullScreen(bridge);
  useDesktopErrorCount(index);
  useDesktopRecordMenu(index);
  const run = useRunCommand();
  const page = usePageState();
  const { canGoBack, canGoForward } = useHistoryEnds();
  const center = page.title ? `Lathe — ${page.title}` : 'Lathe';

  // While the bar shows, the page lays out under it (DesktopTitleBar.css).
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-title-bar', '');
    return () => root.removeAttribute('data-title-bar');
  }, []);

  const back = () => { if (!run('goBack')) window.history.back(); };
  const forward = () => { if (!run('goForward')) window.history.forward(); };

  return (
    <header className={`desktop-title-bar ${platformClass(platform, fullScreen)}`} aria-label="Title bar">
      <div className="title-bar-side title-bar-start">
        <Tooltip label="Go back" command="goBack">
          <Button variant="icon" className="title-bar-button" label="Go back" disabled={!canGoBack} onClick={back}>
            <ArrowIcon direction="left" />
          </Button>
        </Tooltip>
        <Tooltip label="Go forward" command="goForward">
          <Button variant="icon" className="title-bar-button" label="Go forward" disabled={!canGoForward} onClick={forward}>
            <ArrowIcon direction="right" />
          </Button>
        </Tooltip>
      </div>
      <div className="title-bar-center">
        <Tooltip label="Quick find" command="quickOpen">
          <button type="button" className="command-center" aria-label={`${center}. Quick find`} onClick={() => run('quickOpen')}>
            <Icon name="search" size={14} />
            <span className="command-center-text">{center}</span>
          </button>
        </Tooltip>
      </div>
      <div className="title-bar-side title-bar-end">
        <Tooltip label="Show or hide the navigation" command="toggleNav">
          <Button variant="icon" className={`title-bar-button${page.navShown ? ' is-on' : ''}`} label="Show or hide the navigation" aria-pressed={page.navShown} onClick={() => run('toggleNav')}>
            <Icon name="sidebar-left" size={16} />
          </Button>
        </Tooltip>
        <Tooltip label="Show or hide the inspector" command="toggleInspector">
          <Button
            variant="icon"
            className={`title-bar-button${page.inspectorShown ? ' is-on' : ''}`}
            label="Show or hide the inspector"
            aria-pressed={page.inspectorShown}
            disabled={!page.inspectorOffered}
            onClick={() => run('toggleInspector')}
          >
            <Icon name="sidebar-right" size={16} />
          </Button>
        </Tooltip>
      </div>
    </header>
  );
}
