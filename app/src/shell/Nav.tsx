import { forwardRef, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { Button } from '../components/Button';
import { APPEARANCE_PATH, PaletteIcon } from '../theme/ThemeCommands';
import { Icon } from '../components/icons';
import { LongList } from '../components/LongList';
import { treeParent } from '../graph/tree';
import { LatheLogo } from '../LatheLogo';
import { Link } from '../router';
import { parseSpecRoute, type SpecIndex, type SpecRecord, type SpecState, type Stage } from '../specs/data';
import { branchOf, domainFolders, productFolders, sharedKey, type Folder, type StageFolders } from '../specs/folders';
import { recordText, StageMark } from '../specs/parts';
import { useShortcutHint } from './commands';
import { SPACE_KEYS, spaceCommandId } from './keymap';
import { isBool, usePref } from './prefs';
import { QuickFind } from './QuickFind';
import { SpaceMark, useSpaces, type Space } from './spaces';
import { Tooltip } from './Tooltip';
import { trapTab } from './useNarrow';
import { addressOf, checksPathOf, HOME_PATH } from '../views/address';

// The side navigation. At its far left, when the workspace shows two or more products, is the space
// rail: one square icon per product (each product is its own space); with one product there is no
// rail, the panel takes its width, and the product's name and icon head the panel. The panel is all
// the current space's: a quick find of
// the space, its overview, its own stages (its business outcomes and what it shares, in Shared), its domains (each
// folded into its stages and their folders) and its groups, then Tools (the space's Checks), a section that folds on its
// own, and a footer with Appearance and where the specs come from (the record format is a command and a
// link in the shortcuts sheet). The nav
// collapses to the rail alone (remembered; with one product it holds no spaces), and on a narrow
// screen it is a drawer that keeps the rail.
//
// Nothing in it jumps (LA-PAT-APP-UX-R08): its lists are drawn once the specs have loaded, never
// drawn and then pushed down; and only a move made in the nav reshapes it.
// A page opened from a link in the nav, or on the nav's first draw, opens its branch and scrolls
// its row into view. A page opened anywhere else (a link in the page, the graph, Back, quick find)
// leaves the nav's rows where they are: the closed row that holds the page is marked instead, and
// opening it opens the branch down to the page.

export interface NavProps {
  /** The specs as the current space sees them: its own index. */
  spec: SpecState;
  path: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /** The rail's expand button's name while the nav is collapsed for space (LA-PAT-APP-UX-R18), not by the Reader. */
  expandLabel?: string;
  /** On a narrow screen: shown as a drawer. */
  drawer: boolean;
  drawerOpen: boolean;
  onCloseDrawer: () => void;
  findRef: { current: HTMLInputElement | null };
}

type SectionId = 'tools';
const SECTIONS_KEY = 'lathe:nav-sections';
/** Whether the last workspace loaded had two or more products, so the rail is drawn where it will stay before the specs load. */
const RAIL_KEY = 'lathe:space-rail';
const isOpenMap = (v: unknown): v is Record<string, boolean> => !!v && typeof v === 'object' && !Array.isArray(v) && Object.values(v).every(isBool);

const here = (path: string, to: string) => (path === to ? 'page' : undefined);

/** Which section holds the current page. */
function sectionOf(path: string): SectionId | null {
  if (parseSpecRoute(path)?.page === 'checks') return 'tools';
  return null;
}

export const Nav = forwardRef<HTMLElement, NavProps>(function Nav(props, ref) {
  const { spec, path, collapsed, onToggleCollapsed, expandLabel, drawer, drawerOpen, onCloseDrawer, findRef } = props;
  const { index } = spec;
  const spaces = useSpaces();
  const space = spaces?.current ?? null;
  const [sections, setSections] = usePref<Record<string, boolean>>(SECTIONS_KEY, {}, isOpenMap);
  const isOpen = (id: SectionId) => sections[id] !== false;
  const toggle = (id: SectionId) => setSections((s) => ({ ...s, [id]: !(s[id] !== false) }));
  const scroller = useRef<HTMLDivElement>(null);
  const checksKeys = useShortcutHint('openChecks');
  // Whether the nav is used from the keyboard: then the selected row also shows a focus outline, as in VS Code.
  const [keyboard, setKeyboard] = useState(false);

  // The section holding the current page opens itself.
  const current = sectionOf(path);
  useEffect(() => {
    if (current) setSections((s) => (s[current] === false ? { ...s, [current]: true } : s));
  }, [current, setSections]);

  // The nav's lists wait for the specs, so nothing is drawn and then pushed down.
  const loaded = index !== null || !!spec.error;
  // The space rail shows only with two or more products. Until the specs load, it shows as it did last time, so the
  // panel beside it does not move sideways once they have.
  const several = (spaces?.spaces.length ?? 0) > 1;
  const [railBefore, setRailBefore] = usePref<boolean>(RAIL_KEY, true, isBool);
  const showRail = index ? several : railBefore;
  useEffect(() => { if (index) setRailBefore(several); }, [index, several, setRailBefore]);

  // The address last followed from a link in the nav (its rows or its rail). Only that move may
  // reshape the nav; once the address moves on another way, it is forgotten.
  const followed = useRef<string | null>(null);
  const fromNav = followed.current === path;
  useEffect(() => { if (followed.current !== path) followed.current = null; }, [path]);
  const onClickCapture = (e: MouseEvent) => {
    const a = (e.target as Element).closest?.('a[href]') as HTMLAnchorElement | null;
    if (a && !a.closest('.quick-find')) followed.current = new URL(a.href, window.location.href).pathname;
  };

  // The current row is scrolled into view on the nav's first draw (and when it is expanded again)
  // and after a move made in the nav; a move made elsewhere leaves the nav's scroll alone. It waits
  // for the row: on a first draw the branch that holds it opens in the same frame.
  const reveal = useRef<string | null>(path);
  if (fromNav) reveal.current = path;
  const wasCollapsed = useRef(collapsed);
  useEffect(() => {
    if (wasCollapsed.current && !collapsed) reveal.current = path;
    wasCollapsed.current = collapsed;
  }, [collapsed, path]);
  useEffect(() => {
    if (!index || reveal.current !== path) return;
    const el = scroller.current?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!el) return;
    el.scrollIntoView?.({ block: 'nearest' });
    reveal.current = null;
  });

  const problems = index?.workspace.problems ?? [];
  const errors = problems.filter((p) => p.severity === 'error').length;
  const warnings = problems.length - errors;
  const checkBadges = (
    <span className="nav-badges">
      {/* The words beside each count are for a screen reader, so the row's name holds what it shows (LA-V61-R44). */}
      {errors > 0 && <span className="nav-badge error" title={`${errors} error${errors === 1 ? '' : 's'}`}>{errors}{' '}<span className="sr-only">error{errors === 1 ? '' : 's'}</span></span>}{' '}
      {warnings > 0 && <span className="nav-badge warning" title={`${warnings} warning${warnings === 1 ? '' : 's'}`}>{warnings}{' '}<span className="sr-only">warning{warnings === 1 ? '' : 's'}</span></span>}
      {problems.length === 0 && index && <span className="nav-badge">0{' '}<span className="sr-only">problems</span></span>}
    </span>
  );
  const sourceNote = index ? <span>Data from <code>{index.workspace.dataDir}/</code></span> : <span>Loading the data…</span>;

  const className = ['menu', 'panel', collapsed && !drawer ? 'is-rail' : '', drawer ? 'is-drawer' : '', drawer && drawerOpen ? 'is-open' : '', keyboard ? 'is-keyboard' : ''].filter(Boolean).join(' ');

  const rail = (
    <SpaceRail
      spaces={showRail ? spaces?.spaces ?? [] : []}
      current={space}
      lastPage={spaces?.lastPage}
      loaded={loaded}
      top={collapsed && !drawer ? (
        <>
          <Tooltip label="Lathe home" command="goHome" placement="right">
            <Link to={HOME_PATH} className="rail-item brand-mark" aria-label="Lathe home"><LatheLogo size={24} /></Link>
          </Tooltip>
          <Tooltip label={expandLabel ?? 'Expand the navigation'} command="toggleNav" placement="right">
            <button type="button" className={`rail-item${expandLabel ? ' is-crowded' : ''}`} aria-label={expandLabel ?? 'Expand the navigation'} aria-expanded={false} aria-controls="nav" onClick={onToggleCollapsed}>
              <Icon name="sidebar-left" />
            </button>
          </Tooltip>
          <Tooltip label="Quick find" command="quickOpen" placement="right">
            <button type="button" className="rail-item" aria-label="Quick find" onClick={() => { onToggleCollapsed(); setTimeout(() => findRef.current?.focus(), 0); }}>
              <Icon name="search" />
            </button>
          </Tooltip>
          <hr className="rail-sep" />
        </>
      ) : null}
      bottom={null}
    />
  );

  if (collapsed && !drawer) {
    return <nav ref={ref} className={className} aria-label="Main" id="nav" data-floating="left" onClickCapture={onClickCapture}>{rail}</nav>;
  }

  return (
    <nav
      ref={ref}
      className={className}
      aria-label="Main"
      id="nav"
      data-floating={drawer ? undefined : 'left'}
      onKeyDown={(e) => {
        if (!keyboard) setKeyboard(true);
        if (drawer && e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); onCloseDrawer(); return; }
        if (drawer) trapTab(e, e.currentTarget);
      }}
      onPointerDown={() => { if (keyboard) setKeyboard(false); }}
      onClickCapture={onClickCapture}
    >
      {showRail && rail}
      <div className="nav-panel">
        <div className="nav-head">
          <Link to={HOME_PATH} className="brand"><LatheLogo /> <span>Lathe</span></Link>
          <Tooltip label={drawer ? 'Close the navigation' : 'Collapse the navigation'} command="toggleNav">
            <Button
              variant="icon"
              label={drawer ? 'Close the navigation' : 'Collapse the navigation'}
              aria-expanded={true}
              aria-controls="nav"
              onClick={drawer ? onCloseDrawer : onToggleCollapsed}
            >
              <Icon name={drawer ? 'x' : 'sidebar-left'} />
            </Button>
          </Tooltip>
        </div>
        <QuickFind ref={findRef} index={index} />
        <div className="nav-scroll" ref={scroller} aria-busy={!loaded || undefined}>
          {loaded && <>
          {/* The current space needs no heading of its own: its first row, its name and icon, is its overview. */}
          <div className="nav-space">
            {spec.error && !index && <p className="error">{spec.error}</p>}
            {index && space && <SpaceItems index={index} space={space} path={path} reveal={fromNav} />}
            {index && !space && <p className="hint">No products yet.</p>}
          </div>
          {space && (
            <NavSection id="tools" icon="checks" title="Tools" open={isOpen('tools')} onToggle={() => toggle('tools')}>
              <ul>
                <li>
                  <NavRow depth={0} selected={path === checksPathOf(space.id)}>
                    <Link to={checksPathOf(space.id)} aria-current={here(path, checksPathOf(space.id))} aria-keyshortcuts={checksKeys.aria}>
                      <Icon name="checks" size={16} /> <span className="nav-label">Checks</span> {checkBadges}
                    </Link>
                  </NavRow>
                </li>
              </ul>
            </NavSection>
          )}
          </>}
        </div>
        <footer className="nav-foot">
          <NavRow depth={0} selected={path === APPEARANCE_PATH}>
            <Link to={APPEARANCE_PATH} aria-current={here(path, APPEARANCE_PATH)}><PaletteIcon size={16} /> <span className="nav-label">Appearance</span></Link>
          </NavRow>
          <p className="nav-source">{sourceNote}</p>
        </footer>
      </div>
    </nav>
  );
});

interface SpaceRailProps {
  spaces: readonly Space[];
  current: Space | null;
  lastPage?: (id: string) => string | undefined;
  /** Until the specs have loaded the spaces are unknown, so the items below them wait too, rather than be pushed down. */
  loaded: boolean;
  top: ReactNode;
  bottom: ReactNode;
}

/** The rail at the far left: the spaces in order. */
function SpaceRail({ spaces, current, lastPage, loaded, top, bottom }: SpaceRailProps) {
  return (
    <div className="rail space-rail">
      {top}
      {loaded && <>
      {spaces.length > 0 && (
        <ul className="rail-spaces" aria-label="Spaces">
          {spaces.map((s, i) => {
            const isCurrent = current?.id === s.id;
            return (
              <li key={s.id}>
                <Tooltip label={s.title} command={i < SPACE_KEYS ? spaceCommandId(i + 1) : undefined} placement="right">
                  <Link
                    to={lastPage?.(s.id) ?? addressOf(s.id)}
                    className={`rail-item space-item${isCurrent ? ' is-current' : ''}`}
                    aria-current={isCurrent ? 'true' : undefined}
                    data-space={s.id}
                  >
                    {/* Named by its title in hidden text, not an aria-label the drawn mark is no part of (LA-V61-R44). */}
                    <SpaceMark space={s} />
                    <span className="sr-only">{s.title}</span>
                  </Link>
                </Tooltip>
              </li>
            );
          })}
        </ul>
      )}
      </>}
      {bottom}
    </div>
  );
}

const FOLDERS_KEY = 'lathe:nav-folders';

/** The nav rows open on the current page: the page's record's domain, stage and folder (or the product's folder). */
function currentBranch(index: SpecIndex, path: string): string[] {
  const route = parseSpecRoute(path.split('?')[0], index);
  if (!route) return [];
  if (route.page === 'domain') return [`domain:${route.domain}`];
  if (route.page === 'record') return branchOf(index, route.id);
  if (route.page === 'group') {
    // The group's place in the tree: its stage and folder rows (and itself, where it is one), up to its domain.
    const chain: string[] = [];
    for (let at: string | null = `${route.parent}/${route.kind}`; at !== null; at = treeParent(index, at)) {
      const record = index.byId.get(at);
      if (record?.kind === 'domain') { chain.unshift(`domain:${at}`); break; }
      if (record) { chain.unshift(...branchOf(index, at)); break; }
      chain.unshift(at);
    }
    return chain;
  }
  return [];
}

/**
 * The current space in the panel: its overview; its own stages (Shared: its business outcomes and what it shares, such
 * as patterns, standards, and the value objects and views two or more domains use); its domains, each folding its stages
 * (Domain model, Use cases, Interaction design, Technical specification, Test plan) and its open questions;
 * then the product's open questions. Each stage holds one folder per kind, each listing the records
 * that start a branch of the stage; a stage with one folder lists its records itself. One level shows by default; every stage and folder folds on its
 * own (remembered for the session) and shows its count, and the current page's branch opens itself.
 * A stage or folder with no records is left out. Names and order come from the schema's stages and kinds.
 */
function SpaceItems({ index, space, path, reveal }: { index: SpecIndex; space: Space; path: string; reveal: boolean }) {
  const domains = index.domainsOf.get(space.id) ?? [];
  const own = productFolders(index, space.id);
  const [opened, setOpened] = usePref<Record<string, boolean>>(FOLDERS_KEY, {}, isOpenMap, 'session');
  const isOpen = (key: string) => opened[key] === true;
  const branch = currentBranch(index, path).join('\n');
  const branchKeys = branch ? branch.split('\n') : [];
  /** A closed row that holds the current page is marked, and opening it opens the branch down to the page. */
  const holds = (key: string) => !isOpen(key) && branchKeys.includes(key);
  const toggle = (key: string) => setOpened((o) => {
    if (o[key] === true) return { ...o, [key]: false };
    const at = branchKeys.indexOf(key);
    return { ...o, ...Object.fromEntries((at >= 0 ? branchKeys.slice(at) : [key]).map((k) => [k, true])) };
  });

  // The current page's branch opens itself on the nav's first draw and after a move made in the nav,
  // before paint; a move made elsewhere leaves the rows where they are (LA-V61-R28).
  const firstDraw = useRef(true);
  useLayoutEffect(() => {
    const first = firstDraw.current;
    firstDraw.current = false;
    if (!branch || (!first && !reveal)) return;
    const keys = branch.split('\n');
    setOpened((o) => (keys.every((k) => o[k] === true) ? o : { ...o, ...Object.fromEntries(keys.map((k) => [k, true])) }));
  }, [branch, reveal, setOpened]);

  const recordRows = (records: SpecRecord[], label: string, depth: number) => (
    <LongList
      label={label}
      className="nav-records"
      items={records}
      itemKey={(r) => r.id}
      searchText={recordText}
      render={(r) => (
        <NavRow depth={depth} selected={path === addressOf(r.id)}>
          <Link to={addressOf(r.id)} aria-current={here(path, addressOf(r.id))} title={`${r.id} ${r.title}`}>
            <span className="nav-label">{r.title}</span>
          </Link>
        </NavRow>
      )}
    />
  );
  const folderRow = (folder: Folder, owner: string, depth: number) => (
    <NavFolder key={folder.key} id={folder.key} depth={depth} label={folder.label} count={folder.count} open={isOpen(folder.key)} holds={holds(folder.key)} onToggle={() => toggle(folder.key)}>
      {recordRows(folder.records, `${folder.label} of ${owner}`, depth + 1)}
    </NavFolder>
  );
  // An owner's stages with records, each folding its folders with records, or a stage with one folder its records.
  const stageRows = (stages: StageFolders[], owner: string, depth: number) => stages.filter((stage) => stage.count > 0).map((stage) => (
    <NavFolder key={stage.key} id={stage.key} depth={depth} label={stage.label} count={stage.count} open={isOpen(stage.key)} holds={holds(stage.key)} onToggle={() => toggle(stage.key)} stage={stage.stage}>
      {stage.direct ? recordRows(stage.direct.records, `${stage.label} of ${owner}`, depth + 1) : (
        <ul className="nav-tree" aria-label={`${stage.label} of ${owner}`}>
          {stage.folders.filter((f) => f.count > 0).map((f) => folderRow(f, owner, depth + 1))}
        </ul>
      )}
    </NavFolder>
  ));
  const ownStages = own.stages.filter((s) => s.count > 0);

  return (
    <div className="space-items" data-space={space.id}>
      <ul>
        <li>
          <NavRow depth={0} selected={path === addressOf(space.id)}>
            <Link to={addressOf(space.id)} aria-current={here(path, addressOf(space.id))} title={space.title}>
              <SpaceMark space={space} size={18} /> <span className="nav-label">{space.title}</span>
            </Link>
          </NavRow>
        </li>
      </ul>
      {ownStages.length > 0 && (
        // What the product shares, in one folder before the domains, as the graph's tree has it.
        <ul className="nav-tree nav-shared" aria-label={`Shared in ${space.title}`}>
          <NavFolder id={sharedKey(space.id)} depth={0} label="Shared" count={ownStages.reduce((n, s) => n + s.count, 0)} open={isOpen(sharedKey(space.id))} holds={holds(sharedKey(space.id))} onToggle={() => toggle(sharedKey(space.id))}>
            <ul className="nav-tree" aria-label={`Stages of ${space.title}`}>
              {stageRows(ownStages, space.title, 1)}
            </ul>
          </NavFolder>
        </ul>
      )}
      {domains.length > 0 && (
        <LongList
          label={`Domains of ${space.title}`}
          className="nav-tree nav-domains"
          items={domains}
          itemKey={(d) => d.id}
          searchText={recordText}
          render={(domain) => {
            const key = `domain:${domain.id}`;
            const open = isOpen(key);
            const bodyId = `nav-domain-${domain.id.replace(/[^A-Za-z0-9_-]/g, '-')}`;
            const { stages, loose } = open ? domainFolders(index, domain.id) : { stages: [], loose: [] };
            return (
              <>
                <NavRow
                  depth={0}
                  selected={path === addressOf(domain.id)}
                  holds={holds(key)}
                  chevron={(
                    <button type="button" className="nav-chevron" aria-expanded={open} aria-controls={bodyId} aria-label={`${open ? 'Fold' : 'Unfold'} ${domain.title}`} onClick={() => toggle(key)}>
                      <Icon name={open ? 'chevron-down' : 'chevron-right'} size={14} />
                    </button>
                  )}
                >
                  <Link to={addressOf(domain.id)} aria-current={here(path, addressOf(domain.id))} title={domain.title}>
                    <span className="nav-label">{domain.title}</span>
                  </Link>
                </NavRow>
                {open && (
                  <ul className="nav-tree" id={bodyId} aria-label={`Folders of ${domain.title}`}>
                    {stageRows(stages, domain.title, 1)}
                    {loose.map((f) => folderRow(f, domain.title, 1))}
                  </ul>
                )}
              </>
            );
          }}
        />
      )}
      {own.loose.length > 0 && (
        <ul className="nav-groups" aria-label={`Groups of ${space.title}`}>
          {own.loose.map((folder) => {
            const to = addressOf(folder.key);
            return (
              <li key={folder.key}>
                <NavRow depth={0} selected={path === to}>
                  <Link to={to} aria-current={here(path, to)}>
                    <span className="nav-label">{folder.label}</span> <span className="nav-badge quiet">{folder.count}</span>
                  </Link>
                </NavRow>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * One row of the nav, as in VS Code's explorer: as wide as the nav panel, indented by padding for
 * its depth, with the indent guides drawn inside it and its fold chevron (or the chevron's space)
 * at its start. The current page's row carries the selection over the whole row (LA-V90-R03).
 * Its link stretches over the row, so a click anywhere on it follows the link.
 */
function NavRow({ depth, selected = false, holds = false, chevron, children }: { depth: number; selected?: boolean; holds?: boolean; chevron?: ReactNode; children: ReactNode }) {
  return (
    <div className={`nav-row${selected ? ' is-selected' : ''}${holds ? ' holds-current' : ''}`} style={{ '--depth': depth } as CSSProperties}>
      {chevron ?? <span className="nav-chevron-space" aria-hidden="true" />}
      {children}
    </div>
  );
}

/**
 * A foldable nav row (a stage or a folder) with its count, holding its rows below it when open. The button is the
 * row. A stage's row carries its stage's color mark.
 */
function NavFolder({ id, depth, label, count, open, holds = false, onToggle, stage, children }: { id: string; depth: number; label: string; count: number; open: boolean; holds?: boolean; onToggle: () => void; stage?: Stage; children: ReactNode }) {
  const bodyId = `nav-folder-${id.replace(/[^A-Za-z0-9_-]/g, '-')}`;
  return (
    <li className={`nav-folder${stage ? ' is-stage' : ''}`}>
      <button type="button" className={`nav-folder-head nav-row${holds ? ' holds-current' : ''}`} style={{ '--depth': depth } as CSSProperties} aria-expanded={open} aria-controls={bodyId} aria-description={holds ? 'Holds the current page' : undefined} onClick={onToggle}>
        <Icon name={open ? 'chevron-down' : 'chevron-right'} size={14} />
        {stage && <StageMark stage={stage} />}
        <span className="nav-label">{label}</span>
        <span className="nav-badge quiet">{count}</span>
      </button>
      {open && <div id={bodyId} className="nav-folder-body">{children}</div>}
    </li>
  );
}

function NavSection({ id, icon, title, count, open, onToggle, children }: { id: string; icon: string; title: string; count?: number; open: boolean; onToggle: () => void; children: ReactNode }) {
  const bodyId = `nav-section-${id}`;
  return (
    <section className="nav-section" aria-labelledby={`${bodyId}-head`}>
      <button type="button" id={`${bodyId}-head`} className="nav-section-head nav-row" aria-expanded={open} aria-controls={bodyId} onClick={onToggle}>
        <Icon name={open ? 'chevron-down' : 'chevron-right'} size={14} />
        <Icon name={icon} size={16} />
        <span className="eyebrow">{title}</span>
        {count !== undefined && <span className="nav-badge quiet">{count}</span>}
      </button>
      {open && <div id={bodyId} className="nav-section-body">{children}</div>}
    </section>
  );
}
