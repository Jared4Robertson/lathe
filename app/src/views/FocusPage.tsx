import { lazy, Suspense, useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { Icon } from '../components/icons';
import { ResizeHandle } from '../components/ResizeHandle';
import { expandAllOnPage } from '../components/TreeList';
import type { GraphSettings } from '../graph/GraphPage';
import { NO_FILTERS, groupLabel, groupMembers, isGroup, parseGroupId, pluralLabel } from '../graph/model';
import type { GraphInfo } from '../graph/panel';
import { ModelIcon } from '../model/ModelIcon';
import { Link, navigate } from '../router';
import { useAnnounce, useCommand } from '../shell/commands';
import { Tooltip } from '../shell/Tooltip';
import { isBool, isNumber, readPref, usePanelSize, usePref, writePref } from '../shell/prefs';
import { useNarrow } from '../shell/useNarrow';
import { recordPath, type Problem, type SpecIndex, type SpecState } from '../specs/data';
import { Markdown } from '../specs/Markdown';
import { PageHeader, ProblemBadge, RecordTree, Section, listTitle } from '../specs/parts';
import { RecordContent, RecordEyebrow } from '../specs/RecordContent';
import { folderPath, testGroups } from '../specs/folders';
import { GroupSections } from '../specs/FolderGroups';
import { DomainWiki, NotFound, ProductWiki, SourceNote, problemsUnder } from '../specs/SpecPages';
import { addressOf, focusOf, parseViews, VIEW_LABELS, VIEW_NAMES, viewsFromSearch, viewsOffered, viewsShown, withView, type FocusRoute, type ViewName } from './address';
import { Inspector } from './Inspector';

// One page for one thing (a record, a group, a product or a domain), at one address, in up to
// three views, each a pane you open and close: Wiki (the page to read), Graph (the graph centered
// on it) and Model (the ERD of a domain, an aggregate or an entity's aggregate; offered only there).
// The open panes sit side by side in the order Wiki, Graph, Model, with a handle to drag in every
// gap. Every pane shows the same focus: clicking a node or a box changes the address and the others
// follow. Any pane can be maximized. The inspector, the page's last column, shows the focused
// record whichever views are open.

const GraphView = lazy(() => import('../graph/GraphPage').then((m) => ({ default: m.GraphView })));
const ModelView = lazy(() => import('../model/ModelView').then((m) => ({ default: m.ModelView })));

const VIEW_KEY = 'lathe:view';
const INSPECTOR_KEY = 'lathe:inspector-open';
const INSPECTOR_WIDTH_KEY = 'lathe:inspector-width';
const PANE_SIZE_KEY = (v: ViewName) => `lathe:pane-size:${v}`;
const GRAPH_KEY = 'lathe:graph-settings';
const VIEW_COMMANDS: Record<ViewName, string> = { wiki: 'viewWiki', graph: 'viewGraph', model: 'viewModel' };
/** Each pane's share of the width is a weight (remembered); equal weights share the space evenly. */
const PANE_WEIGHT = 100;
/** The narrowest a pane gets, and the limits of one pane's share of the two panes beside a gap, in percent. */
const PANE_MIN_PX = 220;
const GAP_MIN = 20;
const GAP_MAX = 80;
const isString = (v: unknown): v is string => typeof v === 'string';
const lower = (v: ViewName) => VIEW_LABELS[v].toLowerCase();

function ViewIcon({ view, size = 16 }: { view: ViewName; size?: number }) {
  return view === 'model' ? <ModelIcon size={size} /> : <Icon name={view} size={size} />;
}

// ---------- Graph settings kept for the session ----------

interface StoredSettings { depth: number; trace: boolean; hiddenKinds: string[]; hiddenRelations: string[]; openGroups: [string, boolean][] }
const isStored = (v: unknown): v is StoredSettings => !!v && typeof v === 'object' && isNumber((v as StoredSettings).depth) && Array.isArray((v as StoredSettings).hiddenKinds);

function loadSettings(): GraphSettings | null {
  const s = readPref<StoredSettings | null>(GRAPH_KEY, null, (v): v is StoredSettings | null => v === null || isStored(v), 'session');
  if (!s) return null;
  return {
    depth: [1, 2, 3].includes(s.depth) ? s.depth : 1,
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

  // The open views: those the link names, otherwise those last open ("wiki,graph"; the old
  // single names and "split" read the same way). Model shows only where it is offered; the views
  // asked for but not offered here are kept, so they come back on a page that offers them.
  const [stored, setStored] = usePref<string>(VIEW_KEY, 'wiki', isString);
  const linked = viewsFromSearch(search);
  const asked = linked ?? (parseViews(stored).length > 0 ? parseViews(stored) : (['wiki'] as ViewName[]));
  const askedKey = asked.join(',');
  useEffect(() => { if (linked && askedKey !== stored) setStored(askedKey); }, [linked, askedKey, stored, setStored]);
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
    setStored(views.join(','));
    navigate(withView(window.location.pathname, views), true);
    setFull(null);
    announce(message);
  }, [asked, offered, setStored, announce]);

  /** Turns a view on or off; the last open view stays open. */
  const toggleView = useCallback((view: ViewName) => {
    if (!offered.includes(view)) return;
    lastToggled.current = view;
    if (open.includes(view)) {
      if (open.length === 1) { announce(`The ${lower(view)} view stays open: it is the only one`); return; }
      setViews(open.filter((v) => v !== view), `${VIEW_LABELS[view]} view closed`);
    } else {
      setViews([...open, view], `${VIEW_LABELS[view]} view opened`);
    }
  }, [offered, open, setViews, announce]);

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

  // Pane sizes: one remembered weight per view, so each gap between two open panes resizes them.
  const sizes = {
    wiki: usePanelSize(PANE_SIZE_KEY('wiki'), PANE_WEIGHT, 1, 10000),
    graph: usePanelSize(PANE_SIZE_KEY('graph'), PANE_WEIGHT, 1, 10000),
    model: usePanelSize(PANE_SIZE_KEY('model'), PANE_WEIGHT, 1, 10000),
  } satisfies Record<ViewName, readonly [number, (v: number) => void, () => void]>;
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

  // Graph settings survive moving between pages and views (for the session).
  const [settings, setSettingsState] = useState<GraphSettings>(() => loadSettings() ?? DEFAULT_SETTINGS);
  const setSettings = useCallback((s: GraphSettings) => { setSettingsState(s); saveSettings(s); }, []);
  const [graphInfo, setGraphInfo] = useState<GraphInfo | null>(null);
  const onGraph = useCallback((info: GraphInfo) => setGraphInfo(info), []);

  // A link keeps the views asked for; the page it leads to shows those it offers.
  const hrefFor = useCallback((id: string) => withView(addressOf(index, id), asked), [index, askedKey]);
  const onNavigate = useCallback((id: string) => navigate(hrefFor(id)), [hrefFor]);

  const wikiPane = useRef<HTMLDivElement>(null);
  useEffect(() => { wikiPane.current?.scrollTo?.(0, 0); }, [focus]);

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

  const inspectorToggle = (
    <Tooltip label={`${showing ? 'Hide' : 'Show'} the inspector`} command="toggleInspector" placement="left">
      <button
        type="button"
        ref={inspectorButton}
        className={`icon-button inspector-toggle${showing ? ' is-on' : ''}`}
        aria-label={`${showing ? 'Hide' : 'Show'} the inspector`}
        aria-expanded={showing}
        aria-controls="inspector"
        onClick={() => setShowing(!showing)}
      >
        <Icon name="sidebar-right" size={16} />
      </button>
    </Tooltip>
  );
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

  /** The pane shown furthest right (the maximized one, when one is), whose bar holds the View toggles. */
  const rightmost: ViewName = full ?? open[open.length - 1];
  /** The pane shown furthest left, which carries the page's title. */
  const leftmost: ViewName = full ?? open[0];

  /** A view toggle's tooltip: what a click does, and that the last open view stays open. */
  const toggleLabel = (v: ViewName) => {
    return open.length === 1 && open[0] === v ? `${VIEW_LABELS[v]} view (stays open: it is the only one)` : `${VIEW_LABELS[v]} view`;
  };

  /**
   * One pane: a panel with one title bar (LA-PAT-APP-CODE-R11), as an editor group in VS Code. At its
   * left a quiet label names its view, with a button that closes the pane when more than one is
   * open. At its right, all icon buttons in one style: on the rightmost pane only, the View toggles
   * and a divider; on every pane its maximize button; on the rightmost pane the inspector toggle.
   */
  const pane = (view: ViewName) => {
    const isFull = full === view;
    const name = VIEW_LABELS[view];
    const last = view === rightmost;
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
            {open.length > 1 && (
              <Tooltip label={`Close the ${lower(view)} pane`}>
                <button type="button" className="icon-button pane-close" aria-label={`Close the ${lower(view)} pane`} onClick={() => toggleView(view)}>
                  <Icon name="x" size={14} />
                </button>
              </Tooltip>
            )}
          </div>
          <div className="pane-actions">
            {last && (
              <>
                <div className="pane-views" role="group" aria-label="View">
                  {offered.map((t) => (
                    <Tooltip key={t} label={toggleLabel(t)} command={VIEW_COMMANDS[t]}>
                      <button
                        type="button"
                        ref={(el) => { toggles.current[t] = el; }}
                        className={`icon-button${open.includes(t) ? ' is-on' : ''}`}
                        aria-label={VIEW_LABELS[t]}
                        aria-pressed={open.includes(t)}
                        data-command={VIEW_COMMANDS[t]}
                        onClick={() => toggleView(t)}
                      >
                        <ViewIcon view={t} />
                      </button>
                    </Tooltip>
                  ))}
                </div>
                <span className="pane-divider" aria-hidden="true" />
              </>
            )}
            <Tooltip label={isFull ? 'Leave full screen' : 'Full screen'} command={isFull ? 'escape' : 'maximizePane'} placement="left">
              <button
                type="button"
                ref={(el) => { fullButtons.current[view] = el; }}
                className="icon-button"
                aria-pressed={isFull}
                aria-label={isFull ? `Leave full screen (${name})` : `Full screen: ${name}`}
                onClick={() => (isFull ? leaveFull() : toggleFull(view))}
              >
                <Icon name={isFull ? 'minimize' : 'maximize'} size={16} />
              </button>
            </Tooltip>
            {last && !narrow && inspectorToggle}
          </div>
        </div>
        <div className={view === 'wiki' ? 'pane-scroll' : 'pane-body'} ref={view === 'wiki' ? wikiPane : undefined}>
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

  const columns = open.map((v) => `minmax(${PANE_MIN_PX}px, ${sizes[v][0]}fr)`).join(' var(--panel-gap) ');
  return (
    <div
      ref={layout}
      className={`focus-layout${showing && !narrow ? ' with-inspector' : ''}`}
      style={{ '--inspector-width': `${inspectorWidth}px` } as CSSProperties}
    >
      <div className="focus-main">
        {narrow && <div className="pane-narrow-actions">{inspectorToggle}</div>}
        <div
          ref={views}
          className={`focus-views panes-${open.length}`}
          data-views={openKey}
          style={open.length > 1 && !narrow ? { gridTemplateColumns: columns } : undefined}
        >
          {open.flatMap((v, i) => (i === 0 ? [pane(v)] : [gap(open[i - 1], v), pane(v)]))}
        </div>
      </div>
      {showing ? (
        <>
          {narrow && <div className="drawer-backdrop" onMouseDown={() => setShowing(false)} />}
          {!narrow && (
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
          )}
          <InspectorHost narrow={narrow} onEscape={() => setShowing(false)}>
            <Inspector
              ref={inspector}
              index={index}
              focus={focus}
              graph={open.includes('graph') ? graphInfo : null}
              onNavigate={onNavigate}
              hrefFor={hrefFor}
              onClose={() => setShowing(false)}
              drawer={narrow}
            />
          </InspectorHost>
        </>
      ) : null}
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
      className={narrow ? 'inspector-drawer' : 'inspector-column panel'}
      onKeyDown={narrow ? (e) => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); onEscape(); } } : undefined}
    >
      {children}
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
    // whole title in its tooltip), so the canvas below never moves when the focus changes.
    <div className={`pane-title${fixed ? ' is-fixed' : ''}`} title={fixed ? title : undefined}>
      <PageHeader eyebrow={eyebrow} title={title} id={id}>
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

/** Reads the views last open. */
export const rememberedViews = (): ViewName[] => parseViews(readPref<string>(VIEW_KEY, 'wiki', isString));
