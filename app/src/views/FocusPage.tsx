import { lazy, Suspense, useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { Icon } from '../components/icons';
import { expandAllOnPage } from '../components/TreeList';
import type { GraphSettings } from '../graph/GraphPage';
import { NO_FILTERS, groupLabel, groupMembers, isGroup, parseGroupId, pluralLabel } from '../graph/model';
import type { GraphInfo } from '../graph/panel';
import { Link, navigate } from '../router';
import { useAnnounce, useCommand } from '../shell/commands';
import { Tooltip } from '../shell/Tooltip';
import { isBool, isNumber, readPref, usePref, writePref } from '../shell/prefs';
import { useNarrow } from '../shell/useNarrow';
import { recordPath, type Problem, type SpecIndex, type SpecState } from '../specs/data';
import { Markdown } from '../specs/Markdown';
import { PageHeader, ProblemBadge, RecordTree, Section } from '../specs/parts';
import { RecordContent, RecordEyebrow } from '../specs/RecordContent';
import { DomainWiki, NotFound, ProductWiki, SourceNote, problemsUnder } from '../specs/SpecPages';
import { addressOf, focusOf, isViewMode, VIEW_LABELS, VIEW_MODES, viewFromSearch, withView, type FocusRoute, type ViewMode } from './address';
import { Inspector } from './Inspector';

// One page for one thing (a record, a group, a product or a domain), at one address, in three
// views: Wiki (the page to read), Graph (the graph centered on it) and Split (both side by side,
// with a divider to drag). Both panes show the same focus: clicking a node changes the address and
// the wiki follows; following a link in the wiki re-centers the graph. Either pane can go full
// screen. The inspector, the page's third column, shows the focused record whichever view is open.

const GraphView = lazy(() => import('../graph/GraphPage').then((m) => ({ default: m.GraphView })));

const VIEW_KEY = 'lathe:view';
const INSPECTOR_KEY = 'lathe:inspector-open';
const SPLIT_KEY = 'lathe:split-ratio';
const GRAPH_KEY = 'lathe:graph-settings';
const VIEW_COMMANDS: Record<ViewMode, string> = { wiki: 'viewWiki', graph: 'viewGraph', split: 'viewSplit' };
const VIEW_ICONS: Record<ViewMode, string> = { wiki: 'wiki', graph: 'graph', split: 'split' };

// ---------- Graph settings kept for the session ----------

interface StoredSettings { depth: number; trace: boolean; hiddenKinds: string[]; hiddenRelations: string[]; openGroups: [string, boolean][] }
const isStored = (v: unknown): v is StoredSettings => !!v && typeof v === 'object' && isNumber((v as StoredSettings).depth) && Array.isArray((v as StoredSettings).hiddenKinds);

function loadSettings(): GraphSettings | null {
  const s = readPref<StoredSettings | null>(GRAPH_KEY, null, (v): v is StoredSettings | null => v === null || isStored(v), 'session');
  if (!s) return null;
  return {
    depth: s.depth === 2 ? 2 : 1,
    trace: s.trace === true,
    filters: { hiddenKinds: new Set(s.hiddenKinds), hiddenRelations: new Set(s.hiddenRelations ?? []) },
    openGroups: new Map((s.openGroups ?? []).filter((e) => Array.isArray(e) && typeof e[0] === 'string')),
  };
}
function saveSettings(s: GraphSettings) {
  writePref(GRAPH_KEY, { depth: s.depth, trace: s.trace, hiddenKinds: [...s.filters.hiddenKinds], hiddenRelations: [...s.filters.hiddenRelations], openGroups: [...s.openGroups] }, 'session');
}
const DEFAULT_SETTINGS: GraphSettings = { depth: 1, trace: false, filters: NO_FILTERS, openGroups: new Map() };

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

  // The view: from the link when it names one, otherwise the one last chosen.
  const [stored, setStored] = usePref<ViewMode>(VIEW_KEY, 'wiki', isViewMode);
  const linked = viewFromSearch(search);
  const mode = linked ?? stored;
  useEffect(() => { if (linked && linked !== stored) setStored(linked); }, [linked, stored, setStored]);
  const lastSingle = useRef<ViewMode>(mode === 'split' ? 'wiki' : mode);
  if (mode !== 'split') lastSingle.current = mode;

  const toggles = useRef<Partial<Record<ViewMode, HTMLButtonElement | null>>>({});
  const setMode = useCallback((next: ViewMode) => {
    setStored(next);
    navigate(withView(window.location.pathname, next), true);
    setFull(null);
    announce(`${VIEW_LABELS[next]} view`);
  }, [setStored, announce]);
  // Keep focus when the element that had it went away with a pane.
  useEffect(() => {
    const active = document.activeElement;
    if (!active || active === document.body || !active.isConnected) toggles.current[mode]?.focus();
  }, [mode]);

  // Full screen for one pane.
  const [full, setFull] = useState<'wiki' | 'graph' | null>(null);
  const fullButtons = useRef<Partial<Record<'wiki' | 'graph', HTMLButtonElement | null>>>({});
  const toggleFull = useCallback((pane: 'wiki' | 'graph') => {
    setFull((f) => {
      const next = f === pane ? null : pane;
      announce(next ? `${next === 'wiki' ? 'Wiki' : 'Graph'} pane full screen. Escape returns.` : 'Full screen closed');
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

  // The split.
  const [ratio, setRatio] = usePref<number>(SPLIT_KEY, 50, isNumber);
  const views = useRef<HTMLDivElement>(null);

  // The inspector.
  const [inspectorOpen, setInspectorOpen] = usePref<boolean>(INSPECTOR_KEY, true, isBool);
  const [drawer, setDrawer] = useState(false);
  const inspector = useRef<HTMLElement>(null);
  const inspectorButton = useRef<HTMLButtonElement>(null);
  const showing = narrow ? drawer : inspectorOpen;
  const setShowing = useCallback((open: boolean) => {
    if (narrow) setDrawer(open); else setInspectorOpen(open);
    announce(open ? 'Inspector shown' : 'Inspector hidden');
    if (!open) setTimeout(() => inspectorButton.current?.focus(), 0);
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

  // Graph settings survive moving between pages and views (for the session).
  const [settings, setSettingsState] = useState<GraphSettings>(() => loadSettings() ?? DEFAULT_SETTINGS);
  const setSettings = useCallback((s: GraphSettings) => { setSettingsState(s); saveSettings(s); }, []);
  const [graphInfo, setGraphInfo] = useState<GraphInfo | null>(null);
  const onGraph = useCallback((info: GraphInfo) => setGraphInfo(info), []);

  const hrefFor = useCallback((id: string) => withView(addressOf(index, id), mode), [index, mode]);
  const onNavigate = useCallback((id: string) => navigate(hrefFor(id)), [hrefFor]);

  const wikiPane = useRef<HTMLDivElement>(null);
  useEffect(() => { wikiPane.current?.scrollTo?.(0, 0); }, [focus]);

  // Commands.
  useCommand('viewWiki', () => setMode('wiki'));
  useCommand('viewGraph', () => setMode('graph'));
  useCommand('viewSplit', () => setMode('split'));
  useCommand('toggleSplit', () => setMode(mode === 'split' ? lastSingle.current : 'split'));
  useCommand('toggleFullScreen', () => {
    const inGraph = !!(document.activeElement as HTMLElement | null)?.closest?.('.pane-graph');
    toggleFull(mode === 'graph' || (mode === 'split' && inGraph) ? 'graph' : 'wiki');
  });
  useCommand('escape', leaveFull, full !== null);
  useCommand('toggleInspector', () => setShowing(!showing));
  useCommand('focusInspector', () => openInspectorAt());
  useCommand('showReferences', () => openInspectorAt('.links-in-heading'), index.byId.has(focus));
  useCommand('expandAll', () => { expandAllOnPage(true); announce('Expanded every row'); });
  useCommand('collapseAll', () => { expandAllOnPage(false); announce('Collapsed every row'); });

  const wiki = <WikiContent index={index} route={route} />;
  const graph = (
    <Suspense fallback={<p className="hint graph-loading">Loading the graph…</p>}>
      <GraphView index={index} focus={focus} onNavigate={onNavigate} hrefFor={hrefFor} settings={settings} onSettingsChange={setSettings} onGraph={onGraph} />
    </Suspense>
  );

  const pane = (kind: 'wiki' | 'graph', content: ReactNode) => {
    const isFull = full === kind;
    const name = kind === 'wiki' ? 'Wiki' : 'Graph';
    return (
      <section
        className={`pane pane-${kind}${isFull ? ' is-fullscreen' : ''}`}
        aria-label={`${name} pane`}
        inert={full !== null && !isFull ? true : undefined}
        onKeyDown={isFull ? (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); leaveFull(); } } : undefined}
      >
        <Tooltip label={isFull ? 'Leave full screen' : 'Full screen'} command={isFull ? 'escape' : 'toggleFullScreen'} placement="left">
          <button
            type="button"
            ref={(el) => { fullButtons.current[kind] = el; }}
            className="icon-button pane-full"
            aria-pressed={isFull}
            aria-label={isFull ? `Leave full screen (${name})` : `Full screen: ${name}`}
            onClick={() => (isFull ? leaveFull() : toggleFull(kind))}
          >
            <Icon name={isFull ? 'minimize' : 'maximize'} />
          </button>
        </Tooltip>
        {kind === 'wiki' ? <div className="pane-scroll" ref={wikiPane}>{content}</div> : content}
      </section>
    );
  };

  const onDividerPointer = (e: PointerEvent<HTMLDivElement>) => {
    const box = views.current?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    const el = e.currentTarget;
    el.setPointerCapture?.(e.pointerId);
    const move = (ev: globalThis.PointerEvent) => setRatio(Math.round(Math.min(80, Math.max(20, ((ev.clientX - box.left) / box.width) * 100))));
    const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  };
  const onDividerKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 10 : 5;
    if (e.key === 'ArrowLeft') { e.preventDefault(); setRatio((r) => Math.max(20, r - step)); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); setRatio((r) => Math.min(80, r + step)); }
    else if (e.key === 'Home') { e.preventDefault(); setRatio(20); }
    else if (e.key === 'End') { e.preventDefault(); setRatio(80); }
  };

  const split = mode === 'split';
  return (
    <div className={`focus-layout${showing && !narrow ? ' with-inspector' : ''}`}>
      <div className="focus-main">
        <FocusHeader index={index} route={route}>
          <div className="view-toggle" role="group" aria-label="View">
            {VIEW_MODES.map((m) => (
              <Tooltip key={m} label={`${VIEW_LABELS[m]} view`} command={VIEW_COMMANDS[m]}>
                <button
                  type="button"
                  ref={(el) => { toggles.current[m] = el; }}
                  aria-pressed={mode === m}
                  onClick={() => setMode(m)}
                  data-command={VIEW_COMMANDS[m]}
                >
                  <Icon name={VIEW_ICONS[m]} size={16} /> {VIEW_LABELS[m]}
                </button>
              </Tooltip>
            ))}
          </div>
          <Tooltip label={`${showing ? 'Hide' : 'Show'} the inspector`} command="toggleInspector">
            <button
              type="button"
              ref={inspectorButton}
              className="inspector-toggle"
              aria-expanded={showing}
              aria-controls="inspector"
              onClick={() => setShowing(!showing)}
            >
              <Icon name="sidebar-right" size={16} /> Inspector
            </button>
          </Tooltip>
        </FocusHeader>
        <div
          ref={views}
          className={`focus-views mode-${mode}`}
          style={split && !narrow ? { gridTemplateColumns: `minmax(0, ${ratio}fr) 9px minmax(0, ${100 - ratio}fr)` } : undefined}
        >
          {mode !== 'graph' && pane('wiki', wiki)}
          {split && (
            <div
              className="split-divider"
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize the panes"
              aria-valuemin={20}
              aria-valuemax={80}
              aria-valuenow={ratio}
              tabIndex={0}
              onPointerDown={onDividerPointer}
              onKeyDown={onDividerKey}
              onDoubleClick={() => setRatio(50)}
            />
          )}
          {mode !== 'wiki' && pane('graph', graph)}
        </div>
      </div>
      {showing ? (
        <>
          {narrow && <div className="drawer-backdrop" onMouseDown={() => setShowing(false)} />}
          <InspectorHost narrow={narrow} onEscape={() => setShowing(false)}>
            <Inspector
              ref={inspector}
              index={index}
              focus={focus}
              graph={mode !== 'wiki' ? graphInfo : null}
              onNavigate={onNavigate}
              hrefFor={hrefFor}
              onClose={() => setShowing(false)}
              drawer={narrow}
            />
          </InspectorHost>
        </>
      ) : !narrow && (
        <div className="inspector-rail">
          <Tooltip label="Show the inspector" command="toggleInspector" placement="left">
            <button type="button" className="icon-button" aria-label="Show the inspector" aria-expanded={false} aria-controls="inspector" onClick={() => setShowing(true)}>
              <Icon name="sidebar-right" />
            </button>
          </Tooltip>
        </div>
      )}
    </div>
  );
}

/** On a narrow screen the inspector is a drawer: focus moves into it, Escape closes it. */
function InspectorHost({ narrow, onEscape, children }: { narrow: boolean; onEscape: () => void; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!narrow) return;
    box.current?.querySelector<HTMLElement>('aside')?.focus();
  }, [narrow]);
  return (
    <div
      ref={box}
      className={narrow ? 'inspector-drawer' : 'inspector-column'}
      onKeyDown={narrow ? (e) => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); onEscape(); } } : undefined}
    >
      {children}
    </div>
  );
}

// ---------- Header ----------

function FocusHeader({ index, route, children }: { index: SpecIndex; route: FocusRoute; children: ReactNode }) {
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
    eyebrow = <><Link to={addressOf(index, parent.id)}>{parent.title}</Link> · Group</>;
    title = groupLabel(index, focus);
    id = undefined;
    problems = groupMembers(index, focus).flatMap((m) => index.problemsFor.get(m.id) ?? []);
  }
  return (
    <div className="focus-header">
      <PageHeader eyebrow={eyebrow} title={title} id={id}>
        <div className="focus-actions">
          <ProblemBadge problems={problems} />
          {children}
        </div>
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
  return (
    <div className="spec-body">
      <p className="group-intro">
        {pluralLabel(index, kind)} of <Link to={addressOf(index, parent)} className="record-link"><code>{parent}</code> <span>{parentRecord.title}</span></Link>
      </p>
      {description && <Markdown source={description} />}
      <Section title="Members" count={members.length}>
        <RecordTree index={index} records={members} label={`Members of ${gid}`} />
      </Section>
    </div>
  );
}

/** Reads the remembered view (for the nav's Graph item). */
export const rememberedView = () => readPref<ViewMode>(VIEW_KEY, 'wiki', isViewMode);
