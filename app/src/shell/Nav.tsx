import { forwardRef, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { Button } from '../components/Button';
import { PaletteIcon } from '../theme/ThemeCommands';
import { Icon } from '../components/icons';
import { treeParent } from '../graph/tree';
import { LatheLogo } from '../LatheLogo';
import { Link, useLocation } from '../router';
import { parseSpecRoute } from '../views/spec-route';
import { type RecordIndex, type RecordSummary } from '../exploring/record-summaries/record-index';
import { type DataState } from '../exploring/record-summaries/reads';
import type { Stage } from '../../../lathe/src/platform/data/schema';
import { branchOf, ownerFolders, sharedKey, type Folder, type StageFolders } from '../exploring/folder-tree/folders';
import { StageMark } from '../specs/parts';
import { useProblems } from '../checking/problems/reads';
import { changeCounts, useChanges } from '../changes/changes';
import { navChanges, rollupText, type ChangeCounts } from '../changes/rollup';
import { useRunCommand, useShortcutHint } from './commands';
import { SPACE_KEYS, spaceCommandId } from './keymap';
import { useAggregate } from './prefs';
import { foldOrUnfoldNavEntry } from '../exploring/nav-row/commands/fold-or-unfold-nav-entry';
import { foldOrUnfoldNavSection } from '../exploring/nav-row/commands/fold-or-unfold-nav-section';
import { openNavBranch } from '../exploring/nav-row/commands/open-nav-branch';
import { isFolderOpen, isSectionOpen } from '../exploring/nav-row/model';
import { navRowRepository } from '../exploring/nav-row/repository';
import { noteSpacesListed } from '../exploring/space/commands/note-spaces-listed';
import { spaceRepository } from '../exploring/space/repository';
import { SpaceMark, useSpaces, type Space } from './spaces';
import { Tooltip } from './Tooltip';
import { inertBehind, trapTab } from './useNarrow';
import { addressOf, HOME_PATH } from '../views/address';
import { overlaysOf, panelHref } from '../views/overlays';

// The side navigation. At its far left, when the workspace shows two or more products, is the space
// rail: one square icon per product (each product is its own space); with one product there is no
// rail, the panel takes its width, and the product's name and icon head the panel. The panel is all
// the current space's: a Go to button that opens quick find (QuickOpen.tsx) on
// the space, its overview, its own stages (its business outcomes and what it shares, in Shared), its domains (each
// folded into its stages and their folders) and its groups, then Tools (the space's Checks), a section that folds on its
// own, and a footer with Appearance and where the specs come from (the record format is a command and a
// link in the shortcuts sheet). The nav
// collapses to the rail alone (remembered; with one product it holds no spaces), and on a narrow
// screen it is a drawer that keeps the rail, with Checks and Changes in its footer, always in sight above Appearance
// (on a phone the stage's toolbar has no room for Changes, LA-V90-R76).
//
// Nothing in it jumps (LA-PAT-APP-UX-R08): its lists are drawn once the specs have loaded, never
// drawn and then pushed down; and only a move made in the nav reshapes it.
// A page opened from a link in the nav, or on the nav's first draw, opens its branch and scrolls
// its row into view. A page opened anywhere else (a link in the page, the graph, Back, quick find)
// leaves the nav's rows where they are: the closed row that holds the page is marked instead, and
// opening it opens the branch down to the page.

export interface NavProps {
  /** The specs as the current space sees them: its own index. */
  spec: DataState;
  path: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /** The rail's expand button's name while the nav is collapsed for space (LA-PAT-APP-UX-R18), not by the Reader. */
  expandLabel?: string;
  /** On a narrow screen: shown as a drawer. */
  drawer: boolean;
  drawerOpen: boolean;
  onCloseDrawer: () => void;
}

type SectionId = 'tools';

const here = (path: string, to: string) => (path === to ? 'page' : undefined);

/** Which section holds the tool open over the stage. */
const sectionOf = (panel: string | null): SectionId | null => (panel === 'checks' ? 'tools' : null);

export const Nav = forwardRef<HTMLElement, NavProps>(function Nav(props, ref) {
  const { spec, path, collapsed, onToggleCollapsed, expandLabel, drawer, drawerOpen, onCloseDrawer } = props;
  const run = useRunCommand();
  const findKeys = useShortcutHint('quickOpen');
  const { index } = spec;
  const spaces = useSpaces();
  const space = spaces?.current ?? null;
  const rows = useAggregate(navRowRepository);
  const isOpen = (id: SectionId) => isSectionOpen(rows, id);
  const toggle = (id: SectionId) => foldOrUnfoldNavSection({ section: id, open: !isOpen(id) });
  const scroller = useRef<HTMLDivElement>(null);
  const checksKeys = useShortcutHint('openChecks');
  // Whether the nav is used from the keyboard: then the selected row also shows a focus outline, as in VS Code.
  const [keyboard, setKeyboard] = useState(false);

  // On a narrow screen the open drawer is modal (LA-STD-EXPERIENCE-R13): the page behind it is inert, so only the
  // drawer and its backdrop (a tap there closes it) can be reached; Tab stays in it and Escape closes it (below).
  useEffect(() => (drawer && drawerOpen ? inertBehind(document.getElementById('nav'), '.drawer-backdrop') : undefined), [drawer, drawerOpen]);

  // The section holding the current page opens itself.
  // The tools open over the stage (views/overlays.ts): their nav rows open and close them, and say whether they are open.
  const { search } = useLocation();
  const { panel } = overlaysOf(search);
  const checksOpen = panel === 'checks';
  const changesOpen = panel === 'changes';
  const appearanceOpen = panel === 'appearance' || panel === 'theme';
  const current = sectionOf(panel);
  useEffect(() => {
    if (current) foldOrUnfoldNavSection({ section: current, open: true });
  }, [current]);

  // The nav's lists wait for the specs, so nothing is drawn and then pushed down.
  const loaded = index !== null || !!spec.error;
  // The space rail shows only with two or more products. Until the specs and the products are read, it shows as it did
  // last time, so the panel beside it does not move sideways once they are.
  const several = (spaces?.spaces.length ?? 0) > 1;
  const railBefore = useAggregate(spaceRepository).several;
  const listed = !!index && !!spaces?.read;
  const showRail = listed ? several : railBefore;
  useEffect(() => { if (listed) noteSpacesListed({ several }); }, [listed, several]);

  // The address last followed from a link in the nav (its rows or its rail). Only that move may
  // reshape the nav; once the address moves on another way, it is forgotten.
  const followed = useRef<string | null>(null);
  const fromNav = followed.current === path;
  useEffect(() => { if (followed.current !== path) followed.current = null; }, [path]);
  const onClickCapture = (e: MouseEvent) => {
    const a = (e.target as Element).closest?.('a[href]') as HTMLAnchorElement | null;
    // Only a link to another page is a move made in the nav: a tool's link (Appearance, Checks) keeps the page.
    if (a) { const to = new URL(a.href, window.location.href).pathname; if (to !== window.location.pathname) followed.current = to; }
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

  // The space's counts as its Checks panel gives them (list-problems): its own problems and the workspace's.
  const problemsRead = useProblems(index?.product ?? null, index);
  const counted = index && problemsRead.state === 'read' && problemsRead.answer.product === index.product ? problemsRead.answer : null;
  const errors = counted?.errors ?? 0;
  const warnings = counted?.warnings ?? 0;
  const checkBadges = (
    <span className="nav-badges">
      {/* The words beside each count are for a screen reader, so the row's name holds what it shows (LA-V61-R44). */}
      {errors > 0 && <span className="nav-badge error" title={`${errors} error${errors === 1 ? '' : 's'}`}>{errors}{' '}<span className="sr-only">error{errors === 1 ? '' : 's'}</span></span>}{' '}
      {warnings > 0 && <span className="nav-badge warning" title={`${warnings} warning${warnings === 1 ? '' : 's'}`}>{warnings}{' '}<span className="sr-only">warning{warnings === 1 ? '' : 's'}</span></span>}
      {counted && errors + warnings === 0 && <span className="nav-badge">0{' '}<span className="sr-only">problems</span></span>}
    </span>
  );
  const changes = useChanges();
  const changed = changeCounts(changes.changes);
  const changedTotal = changed.added + changed.changed + changed.removed;
  const checksRow = (
    <NavRow depth={0} selected={checksOpen}>
      <Link to={panelHref(checksOpen ? null : 'checks')} aria-expanded={checksOpen} aria-keyshortcuts={checksKeys.aria}>
        <Icon name="checks" size={16} /> <span className="nav-label">Checks</span> {checkBadges}
      </Link>
    </NavRow>
  );
  const changesRow = (
    <NavRow depth={0} selected={changesOpen}>
      <Link to={panelHref(changesOpen ? null : 'changes')} aria-expanded={changesOpen}>
        <Icon name="history" size={16} /> <span className="nav-label">Changes</span>{' '}
        <span className="nav-badges"><span className="nav-badge">{changedTotal}{' '}<span className="sr-only">{changedTotal === 1 ? 'record' : 'records'} changed</span></span></span>
      </Link>
    </NavRow>
  );
  const sourceNote = index ? <span>{index.byId.size} records in <code>{index.product}</code></span> : <span>Loading the data…</span>;

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
            <button type="button" className="rail-item" aria-label="Quick find" aria-haspopup="dialog" aria-keyshortcuts={findKeys.aria} onClick={() => run('quickOpen')}>
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
        <Button className="quick-find-button" icon="search" aria-haspopup="dialog" aria-keyshortcuts={findKeys.aria} onClick={() => run('quickOpen')}>
          <span className="quick-find-label">Go to…</span>
          {findKeys.text && <kbd className="kbd kbd-hint" aria-hidden="true">{findKeys.text}</kbd>}
        </Button>
        <div className="nav-scroll" ref={scroller} aria-busy={!loaded || undefined}>
          {loaded && <>
          {/* The current space needs no heading of its own: its first row, its name and icon, is its overview. */}
          <div className="nav-space">
            {spec.error && !index && <p className="error">{spec.error}</p>}
            {index && space && <SpaceItems index={index} space={space} path={path} reveal={fromNav} />}
            {index && !space && <p className="hint">No products yet.</p>}
          </div>
          {space && !drawer && (
            <NavSection id="tools" icon="checks" title="Tools" open={isOpen('tools')} onToggle={() => toggle('tools')}>
              <ul>
                <li>{checksRow}</li>
              </ul>
            </NavSection>
          )}
          </>}
        </div>
        <footer className="nav-foot">
          {/* In the drawer the tools stay in sight, never scrolled away below the space's rows. */}
          {space && drawer && <>{checksRow}{changesRow}</>}
          <NavRow depth={0} selected={appearanceOpen}>
            <Link to={panelHref(appearanceOpen ? null : 'appearance')} className="appearance-button" aria-expanded={appearanceOpen}><PaletteIcon size={16} /> <span className="nav-label">Appearance</span></Link>
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


/**
 * The nav rows open on the current page: the page's record's domain, stage and folder (or the product's folder). A
 * domain page opens none: its own row is always in view, so nothing in the nav moves (LA-V61-R28); its chevron opens it.
 */
function currentBranch(index: RecordIndex, path: string): string[] {
  const route = parseSpecRoute(path.split('?')[0], index);
  if (!route) return [];
  if (route.page === 'domain') return [];
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
 * (Domain model, Use cases, Interface design, Technical specification, Test plan) and its open questions;
 * then the product's open questions. Each stage holds one folder per kind, each listing the records
 * that start a branch of the stage; a stage with one folder lists its records itself. One level shows by default; every stage and folder folds on its
 * own (remembered for the session) and shows its count, and the current page's branch opens itself.
 * A stage or folder with no records is left out. Names and order come from the schema's stages and kinds.
 */
function SpaceItems({ index, space, path, reveal }: { index: RecordIndex; space: Space; path: string; reveal: boolean }) {
  const domains = index.product === space.id ? index.domains : [];
  const own = ownerFolders(index, space.id);
  // With Highlight changes on, each row counts the records under it that are new, changed or removed (changes/rollup.ts).
  const { highlight, byId: changed } = useChanges();
  const rolled = useMemo(() => (highlight ? navChanges(index, changed) : null), [highlight, index, changed]);
  const rows = useAggregate(navRowRepository);
  const isOpen = (key: string) => isFolderOpen(rows, key);
  const branch = currentBranch(index, path).join('\n');
  const branchKeys = branch ? branch.split('\n') : [];
  /** A closed row that holds the current page is marked, and opening it opens the branch down to the page. */
  const holds = (key: string) => !isOpen(key) && branchKeys.includes(key);
  const toggle = (key: string) => foldOrUnfoldNavEntry({ key, branch: branchKeys });

  // The current page's branch opens itself on the nav's first draw and after a move made in the nav,
  // before paint; a move made elsewhere leaves the rows where they are (LA-V61-R28).
  const firstDraw = useRef(true);
  useLayoutEffect(() => {
    const first = firstDraw.current;
    firstDraw.current = false;
    if (!branch || (!first && !reveal)) return;
    openNavBranch({ branch: branch.split('\n') });
  }, [branch, reveal]);

  // A folder lists all its records plainly, in the nav's one scroll: no filter box and no scroll box of its own
  // (quick find and the nav's Go to… find a record among many).
  const recordRows = (records: RecordSummary[], label: string, depth: number) => (
    <ul className="nav-records" aria-label={label}>
      {records.map((r) => (
        <li key={r.id}>
          <NavRow depth={depth} selected={path === addressOf(r.id)}>
            <Link to={addressOf(r.id)} aria-current={here(path, addressOf(r.id))} title={`${r.id} ${r.title}`}>
              <span className="nav-label">{r.title}</span>
            </Link>
          </NavRow>
        </li>
      ))}
    </ul>
  );
  const folderRow = (folder: Folder, owner: string, depth: number) => (
    <NavFolder key={folder.key} id={folder.key} depth={depth} label={folder.label} count={folder.count} changes={rolled?.ofRecords(folder.records.map((r) => r.id))} open={isOpen(folder.key)} holds={holds(folder.key)} onToggle={() => toggle(folder.key)}>
      {recordRows(folder.records, `${folder.label} of ${owner}`, depth + 1)}
    </NavFolder>
  );
  // An owner's stages with records, each folding its folders with records, or a stage with one folder its records.
  const stageRows = (stages: StageFolders[], owner: string, depth: number) => stages.filter((stage) => stage.count > 0).map((stage) => (
    <NavFolder key={stage.key} id={stage.key} depth={depth} label={stage.label} count={stage.count} changes={rolled?.ofRecords(stage.folders.flatMap((f) => f.records.map((r) => r.id)))} open={isOpen(stage.key)} holds={holds(stage.key)} onToggle={() => toggle(stage.key)} stage={stage.stage}>
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
          <NavFolder id={sharedKey(space.id)} depth={0} label="Shared" count={ownStages.reduce((n, s) => n + s.count, 0)} changes={rolled?.ofRecords(ownStages.flatMap((s) => s.folders.flatMap((f) => f.records.map((r) => r.id))))} open={isOpen(sharedKey(space.id))} holds={holds(sharedKey(space.id))} onToggle={() => toggle(sharedKey(space.id))}>
            <ul className="nav-tree" aria-label={`Stages of ${space.title}`}>
              {stageRows(ownStages, space.title, 1)}
            </ul>
          </NavFolder>
        </ul>
      )}
      {domains.length > 0 && (
        <ul className="nav-tree nav-domains" aria-label={`Domains of ${space.title}`}>
          {domains.map((domain) => {
            const key = `domain:${domain.id}`;
            const open = isOpen(key);
            const bodyId = `nav-domain-${domain.id.replace(/[^A-Za-z0-9_-]/g, '-')}`;
            const { stages, loose } = open ? ownerFolders(index, domain.id) : { stages: [], loose: [] };
            return (
              <li key={domain.id}>
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
                <NavChanges depth={0} counts={rolled?.ofDomain(domain.id)} />
                {open && (
                  <ul className="nav-tree" id={bodyId} aria-label={`Folders of ${domain.title}`}>
                    {stageRows(stages, domain.title, 1)}
                    {loose.map((f) => folderRow(f, domain.title, 1))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
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
                <NavChanges depth={0} counts={rolled?.ofRecords(folder.records.map((r) => r.id))} />
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

/** A row's changes with Highlight changes on: "+3 ~5 −1" in each change's color on a line under the row, so no label gives up room; the words are for a screen reader and the tooltip. */
function NavChanges({ counts, depth }: { counts: ChangeCounts | undefined; depth: number }) {
  if (!counts) return null;
  return (
    <div className="nav-changes" style={{ '--depth': depth } as CSSProperties} title={rollupText(counts)}>
      <span className="sr-only">{rollupText(counts)}</span>
      <span aria-hidden="true" className="nav-changes-marks">
        {counts.added > 0 && <span className="is-added">+{counts.added}</span>}
        {counts.changed > 0 && <span className="is-changed">~{counts.changed}</span>}
        {counts.removed > 0 && <span className="is-removed">−{counts.removed}</span>}
      </span>
    </div>
  );
}

/**
 * A foldable nav row (a stage or a folder) with its count, holding its rows below it when open. The button is the
 * row. A stage's row carries its stage's color mark.
 */
function NavFolder({ id, depth, label, count, changes, open, holds = false, onToggle, stage, children }: { id: string; depth: number; label: string; count: number; changes?: ChangeCounts; open: boolean; holds?: boolean; onToggle: () => void; stage?: Stage; children: ReactNode }) {
  const bodyId = `nav-folder-${id.replace(/[^A-Za-z0-9_-]/g, '-')}`;
  return (
    <li className={`nav-folder${stage ? ' is-stage' : ''}`}>
      <button type="button" className={`nav-folder-head nav-row${holds ? ' holds-current' : ''}`} style={{ '--depth': depth } as CSSProperties} aria-expanded={open} aria-controls={bodyId} aria-description={holds ? 'Holds the current page' : undefined} onClick={onToggle}>
        <Icon name={open ? 'chevron-down' : 'chevron-right'} size={14} />
        {stage && <StageMark stage={stage} />}
        <span className="nav-label">{label}</span>
        <span className="nav-badge quiet">{count}</span>
      </button>
      <NavChanges depth={depth} counts={changes} />
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
