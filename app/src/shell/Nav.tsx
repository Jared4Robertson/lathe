import { forwardRef, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Icon } from '../components/icons';
import { LongList } from '../components/LongList';
import { childKinds, pluralLabel } from '../graph/model';
import { LatheLogo } from '../LatheLogo';
import { Link } from '../router';
import { checksPath, domainPath, formatPath, groupPath, parseSpecRoute, productPath, recordPath, type SpecIndex, type SpecRecord, type SpecState } from '../specs/data';
import { branchOf, domainFolders, groupBranchOf, productFolderKinds, productFolders, ungrouped, type Folder, type FolderGroup } from '../specs/folders';
import { recordText } from '../specs/parts';
import type { DiagramSummary } from '../types';
import { SPACE_KEYS, spaceCommandId } from './keymap';
import { isBool, usePref } from './prefs';
import { QuickFind } from './QuickFind';
import { SpaceMark, useSpaces, type Space } from './spaces';
import { Tooltip } from './Tooltip';

// The side navigation. At its far left is the space rail: one square icon per product (each
// product is its own space), a separator, then the items above every product (Diagrams, and
// Checks for all products). Beside it, the panel: a quick find, the current space's overview,
// its shared folder, its domains (folded into stages and folders, as Client lays out its specs) and groups, then Diagrams and Tools, each a section that
// folds on its own, and a footer with the record format and where the specs come from. The nav
// collapses to the rail alone (remembered), and on a narrow screen it is a drawer that keeps
// the rail.

export interface NavProps {
  spec: SpecState;
  path: string;
  diagrams: readonly DiagramSummary[];
  diagramError: string | null;
  /** The form or button for a new diagram. */
  newDiagram: ReactNode;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /** On a narrow screen: shown as a drawer. */
  drawer: boolean;
  drawerOpen: boolean;
  onCloseDrawer: () => void;
  findRef: { current: HTMLInputElement | null };
}

type SectionId = 'diagrams' | 'tools';
const SECTIONS_KEY = 'lathe:nav-sections';
const isOpenMap = (v: unknown): v is Record<string, boolean> => !!v && typeof v === 'object' && !Array.isArray(v) && Object.values(v).every(isBool);

const here = (path: string, to: string) => (path === to ? 'page' : undefined);

/** Which section holds the current page. */
function sectionOf(path: string): SectionId | null {
  if (path.startsWith('/diagrams')) return 'diagrams';
  if (path.startsWith('/checks')) return 'tools';
  return null;
}

export const Nav = forwardRef<HTMLElement, NavProps>(function Nav(props, ref) {
  const { spec, path, diagrams, diagramError, newDiagram, collapsed, onToggleCollapsed, drawer, drawerOpen, onCloseDrawer, findRef } = props;
  const { index } = spec;
  const spaces = useSpaces();
  const space = spaces?.current ?? null;
  const [sections, setSections] = usePref<Record<string, boolean>>(SECTIONS_KEY, {}, isOpenMap);
  const isOpen = (id: SectionId) => sections[id] !== false;
  const toggle = (id: SectionId) => setSections((s) => ({ ...s, [id]: !(s[id] !== false) }));
  const scroller = useRef<HTMLDivElement>(null);
  // Whether the nav is used from the keyboard: then the selected row also shows a focus outline, as in VS Code.
  const [keyboard, setKeyboard] = useState(false);

  // The section holding the current page opens itself.
  const current = sectionOf(path);
  useEffect(() => {
    if (current) setSections((s) => (s[current] === false ? { ...s, [current]: true } : s));
  }, [current, setSections]);

  // The current item is scrolled into view.
  useEffect(() => {
    const el = scroller.current?.querySelector<HTMLElement>('[aria-current="page"]');
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [path, index]);

  const problems = index?.workspace.problems ?? [];
  const errors = problems.filter((p) => p.severity === 'error').length;
  const warnings = problems.length - errors;
  const checksLabel = `Checks: ${errors} error${errors === 1 ? '' : 's'}, ${warnings} warning${warnings === 1 ? '' : 's'}`;
  const checkBadges = (
    <span className="nav-badges">
      {errors > 0 && <span className="nav-badge error" title={`${errors} error${errors === 1 ? '' : 's'}`}>{errors}</span>}
      {warnings > 0 && <span className="nav-badge warning" title={`${warnings} warning${warnings === 1 ? '' : 's'}`}>{warnings}</span>}
      {problems.length === 0 && index && <span className="nav-badge">0</span>}
    </span>
  );
  const sourceNote = spec.source === 'fixture'
    ? <span title={spec.sourceReason ?? undefined}>Sample data, not your specs</span>
    : spec.source === 'engine' ? <span>Specs read by the engine</span> : <span>Loading specs…</span>;

  const className = ['menu', 'panel', 'has-spaces', collapsed && !drawer ? 'is-rail' : '', drawer ? 'is-drawer' : '', drawer && drawerOpen ? 'is-open' : '', keyboard ? 'is-keyboard' : ''].filter(Boolean).join(' ');
  const diagramsTo = diagrams[0] ? `/diagrams/${diagrams[0].slug}` : '/';

  const rail = (
    <SpaceRail
      path={path}
      spaces={spaces?.spaces ?? []}
      current={space}
      lastPage={spaces?.lastPage}
      diagramsTo={diagramsTo}
      checksLabel={`Checks for all products: ${checksLabel.slice('Checks: '.length)}`}
      checkDot={errors > 0 ? 'error' : warnings > 0 ? 'warning' : null}
      top={collapsed && !drawer ? (
        <>
          <Tooltip label="Lathe home" command="goHome" placement="right">
            <Link to="/specs" className="rail-item brand-mark" aria-label="Lathe home"><LatheLogo size={24} /></Link>
          </Tooltip>
          <Tooltip label="Expand the navigation" command="toggleNav" placement="right">
            <button type="button" className="rail-item" aria-label="Expand the navigation" aria-expanded={false} aria-controls="nav" onClick={onToggleCollapsed}>
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
      bottom={collapsed && !drawer ? (
        <Tooltip label="Record format" command="goFormat" placement="right">
          <Link to={formatPath} className="rail-item" aria-label="Record format" aria-current={here(path, formatPath)}>
            <Icon name="format" />
          </Link>
        </Tooltip>
      ) : null}
    />
  );

  if (collapsed && !drawer) {
    return <nav ref={ref} className={className} aria-label="Main" id="nav">{rail}</nav>;
  }

  return (
    <nav
      ref={ref}
      className={className}
      aria-label="Main"
      id="nav"
      onKeyDown={(e) => {
        if (!keyboard) setKeyboard(true);
        if (drawer && e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); onCloseDrawer(); }
      }}
      onPointerDown={() => { if (keyboard) setKeyboard(false); }}
    >
      {rail}
      <div className="nav-panel">
        <div className="nav-head">
          <Link to="/specs" className="brand"><LatheLogo /> <span>Lathe</span></Link>
          <Tooltip label={drawer ? 'Close the navigation' : 'Collapse the navigation'} command="toggleNav">
            <button
              type="button"
              className="icon-button"
              aria-label={drawer ? 'Close the navigation' : 'Collapse the navigation'}
              aria-expanded={true}
              aria-controls="nav"
              onClick={drawer ? onCloseDrawer : onToggleCollapsed}
            >
              <Icon name={drawer ? 'x' : 'sidebar-left'} />
            </button>
          </Tooltip>
        </div>
        <QuickFind ref={findRef} index={index} diagrams={diagrams} space={space} />
        <div className="nav-scroll" ref={scroller}>
          {/* The current space needs no heading of its own: the rail names it, and its first row is its overview. */}
          <div className="nav-space">
            {spec.error && !index && <p className="error">{spec.error}</p>}
            {index && space && <SpaceItems index={index} space={space} path={path} />}
            {index && !space && <p className="hint">No products yet.</p>}
          </div>
          <NavSection id="diagrams" icon="diagrams" title="Diagrams" count={diagrams.length} open={isOpen('diagrams')} onToggle={() => toggle('diagrams')}>
            <ul>
              {diagrams.map((d) => (
                <li key={d.slug}>
                  <NavRow depth={0} selected={path === `/diagrams/${d.slug}`}>
                    <Link to={`/diagrams/${d.slug}`} aria-current={here(path, `/diagrams/${d.slug}`)} title={d.title}>
                      <span className="nav-label">{d.title}</span>
                    </Link>
                  </NavRow>
                </li>
              ))}
            </ul>
            {diagramError && <p className="error">{diagramError}</p>}
            {newDiagram}
          </NavSection>
          <NavSection id="tools" icon="checks" title="Tools" open={isOpen('tools')} onToggle={() => toggle('tools')}>
            <ul>
              <li>
                <NavRow depth={0} selected={path === checksPath}>
                  <Link to={checksPath} aria-current={here(path, checksPath)} aria-label={checksLabel}>
                    <Icon name="checks" size={16} /> <span className="nav-label">Checks</span> {checkBadges}
                  </Link>
                </NavRow>
              </li>
            </ul>
          </NavSection>
        </div>
        <footer className="nav-foot">
          <NavRow depth={0} selected={path === formatPath}>
            <Link to={formatPath} aria-current={here(path, formatPath)}><Icon name="format" size={16} /> <span className="nav-label">Record format</span></Link>
          </NavRow>
          <p className={`nav-source ${spec.source === 'fixture' ? 'is-fixture' : ''}`}>{sourceNote}</p>
        </footer>
      </div>
    </nav>
  );
});

interface SpaceRailProps {
  path: string;
  spaces: readonly Space[];
  current: Space | null;
  lastPage?: (id: string) => string | undefined;
  diagramsTo: string;
  checksLabel: string;
  checkDot: 'error' | 'warning' | null;
  top: ReactNode;
  bottom: ReactNode;
}

/** The rail at the far left: the spaces in order, a separator, then Diagrams and Checks for all products. */
function SpaceRail({ path, spaces, current, lastPage, diagramsTo, checksLabel, checkDot, top, bottom }: SpaceRailProps) {
  return (
    <div className="rail space-rail">
      {top}
      {spaces.length > 0 && (
        <ul className="rail-spaces" aria-label="Spaces">
          {spaces.map((s, i) => {
            const isCurrent = current?.id === s.id;
            return (
              <li key={s.id}>
                <Tooltip label={s.title} command={i < SPACE_KEYS ? spaceCommandId(i + 1) : undefined} placement="right">
                  <Link
                    to={lastPage?.(s.id) ?? productPath(s.id)}
                    className={`rail-item space-item${isCurrent ? ' is-current' : ''}`}
                    aria-label={s.title}
                    aria-current={isCurrent ? 'true' : undefined}
                    data-space={s.id}
                  >
                    <SpaceMark space={s} />
                  </Link>
                </Tooltip>
              </li>
            );
          })}
        </ul>
      )}
      <hr className="rail-sep" />
      <Tooltip label="Diagrams" command="goDiagrams" placement="right">
        <Link to={diagramsTo} className="rail-item" aria-label="Diagrams" aria-current={path.startsWith('/diagrams') ? 'page' : undefined}>
          <Icon name="diagrams" />
        </Link>
      </Tooltip>
      <Tooltip label="Checks for all products" command="openChecks" placement="right">
        <Link to={checksPath} className="rail-item" aria-label={checksLabel} aria-current={here(path, checksPath)}>
          <Icon name="checks" />
          {checkDot && <span className={`rail-dot ${checkDot}`} />}
        </Link>
      </Tooltip>
      {bottom}
    </div>
  );
}

const FOLDERS_KEY = 'lathe:nav-folders';

/** The nav rows open on the current page: the page's record's domain, stage and folder (or the product's folder). */
function currentBranch(index: SpecIndex, path: string): string[] {
  const route = parseSpecRoute(path.split('?')[0]);
  if (!route) return [];
  if (route.page === 'domain') return [`domain:${route.domain}`];
  if (route.page === 'record') return branchOf(index, route.id);
  if (route.page === 'group') return groupBranchOf(index, route.parent, route.kind.split('/')[0]);
  return [];
}

/**
 * The current space in the panel, read like Client's spec folders: its overview; its Shared folder
 * (patterns) when it has some; its domains, each folding Define (Domain model, Use cases) and
 * Design (Interaction design, Technical specification, Test plan), then its open questions; and
 * its groups. Technical specification holds the domain's layers (each a row that links to the
 * layer and folds its components) and Test plan its test groups (rows that only fold).
 * One level shows by default; every stage, folder and group folds on its own (remembered for
 * the session) and shows its count, and the current page's branch opens itself. A folder with no
 * records is left out. Names and order come from the workspace's sections.
 */
function SpaceItems({ index, space, path }: { index: SpecIndex; space: Space; path: string }) {
  const domains = index.domainsOf.get(space.id) ?? [];
  const folderKinds = productFolderKinds(index);
  const groups = childKinds(index, space.id).filter((k) => k !== 'domain' && !folderKinds.has(k));
  const shared = productFolders(index, space.id).filter((f) => f.records.length > 0);
  const [opened, setOpened] = usePref<Record<string, boolean>>(FOLDERS_KEY, {}, isOpenMap, 'session');
  const isOpen = (key: string) => opened[key] === true;
  const toggle = (key: string) => setOpened((o) => ({ ...o, [key]: !(o[key] === true) }));

  // The current page's branch opens itself.
  const branch = currentBranch(index, path).join('\n');
  useEffect(() => {
    if (!branch) return;
    const keys = branch.split('\n');
    setOpened((o) => (keys.every((k) => o[k] === true) ? o : { ...o, ...Object.fromEntries(keys.map((k) => [k, true])) }));
  }, [branch, setOpened]);

  const recordRows = (records: SpecRecord[], label: string, depth: number) => (
    <LongList
      label={label}
      className="nav-records"
      items={records}
      itemKey={(r) => r.id}
      searchText={recordText}
      render={(r) => (
        <NavRow depth={depth} selected={path === recordPath(r.id)}>
          <Link to={recordPath(r.id)} aria-current={here(path, recordPath(r.id))} title={`${r.id} ${r.title}`}>
            <span className="nav-label">{r.title}</span>
          </Link>
        </NavRow>
      )}
    />
  );
  // A group's body: the groups within it, then its own records.
  const groupBody = (groups: FolderGroup[], records: SpecRecord[], label: string, owner: string, depth: number) => (
    <>
      {groups.length > 0 && (
        <ul className="nav-tree" aria-label={`${label} of ${owner}`}>
          {groups.map((g) => groupRow(g, owner, depth))}
        </ul>
      )}
      {records.length > 0 && recordRows(records, groups.length > 0 ? `Others in ${label} of ${owner}` : `${label} of ${owner}`, depth)}
    </>
  );
  // A layer is a record, so its row links to its page beside its fold; a test group only folds.
  const groupRow = (group: FolderGroup, owner: string, depth: number): ReactNode => {
    const body = groupBody(group.groups, group.records, group.label, owner, depth + 1);
    if (!group.record) {
      return (
        <NavFolder key={group.key} id={group.key} depth={depth} label={group.label} count={group.count} open={isOpen(group.key)} onToggle={() => toggle(group.key)}>
          {body}
        </NavFolder>
      );
    }
    const open = isOpen(group.key);
    const to = recordPath(group.record.id);
    const bodyId = `nav-folder-${group.key.replace(/[^A-Za-z0-9_-]/g, '-')}`;
    return (
      <li key={group.key} className="nav-folder is-record">
        <NavRow
          depth={depth}
          selected={path === to}
          chevron={(
            <button type="button" className="nav-chevron" aria-expanded={open} aria-controls={bodyId} aria-label={`${open ? 'Fold' : 'Unfold'} ${group.label}`} onClick={() => toggle(group.key)}>
              <Icon name={open ? 'chevron-down' : 'chevron-right'} size={14} />
            </button>
          )}
        >
          <Link to={to} aria-current={here(path, to)} title={`${group.record.id} ${group.record.title}`}>
            <span className="nav-label">{group.label}</span>
            <span className="nav-badge quiet">{group.count}</span>
          </Link>
        </NavRow>
        {open && <div id={bodyId} className="nav-folder-body">{body}</div>}
      </li>
    );
  };
  const folderRow = (folder: Folder, owner: string, depth: number) => (
    <NavFolder key={folder.key} id={folder.key} depth={depth} label={folder.label} count={folder.count} open={isOpen(folder.key)} onToggle={() => toggle(folder.key)}>
      {folder.groups.length > 0
        ? groupBody(folder.groups, ungrouped(folder), folder.label, owner, depth + 1)
        : recordRows(folder.records, `${folder.label} of ${owner}`, depth + 1)}
    </NavFolder>
  );

  return (
    <div className="space-items" data-space={space.id}>
      <ul>
        <li>
          <NavRow depth={0} selected={path === productPath(space.id)}>
            <Link to={productPath(space.id)} aria-current={here(path, productPath(space.id))} title={space.title}>
              <SpaceMark space={space} size={18} /> <span className="nav-label">{space.title}</span>
            </Link>
          </NavRow>
        </li>
      </ul>
      {shared.length > 0 && (
        <ul className="nav-tree nav-shared" aria-label={`Shared by ${space.title}`}>
          {shared.map((f) => folderRow(f, space.title, 0))}
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
                  selected={path === domainPath(space.id, domain.id)}
                  chevron={(
                    <button type="button" className="nav-chevron" aria-expanded={open} aria-controls={bodyId} aria-label={`${open ? 'Fold' : 'Unfold'} ${domain.title}`} onClick={() => toggle(key)}>
                      <Icon name={open ? 'chevron-down' : 'chevron-right'} size={14} />
                    </button>
                  )}
                >
                  <Link to={domainPath(space.id, domain.id)} aria-current={here(path, domainPath(space.id, domain.id))} title={domain.title}>
                    <span className="nav-label">{domain.title}</span>
                  </Link>
                </NavRow>
                {open && (
                  <ul className="nav-tree" id={bodyId} aria-label={`Folders of ${domain.title}`}>
                    {stages.filter((stage) => stage.count > 0).map((stage) => (
                      <NavFolder key={stage.key} id={stage.key} depth={1} label={stage.label} count={stage.count} open={isOpen(stage.key)} onToggle={() => toggle(stage.key)} stage>
                        <ul className="nav-tree" aria-label={`${stage.label} of ${domain.title}`}>
                          {stage.folders.filter((f) => f.records.length > 0).map((f) => folderRow(f, domain.title, 2))}
                        </ul>
                      </NavFolder>
                    ))}
                    {loose.map((f) => folderRow(f, domain.title, 1))}
                  </ul>
                )}
              </>
            );
          }}
        />
      )}
      {groups.length > 0 && (
        <ul className="nav-groups" aria-label={`Groups of ${space.title}`}>
          {groups.map((kind) => {
            const to = groupPath(space.id, kind);
            const count = (index.children.get(space.id) ?? []).filter((c) => c.kind === kind).length;
            return (
              <li key={kind}>
                <NavRow depth={0} selected={path === to}>
                  <Link to={to} aria-current={here(path, to)}>
                    <span className="nav-label">{pluralLabel(index, kind)}</span> <span className="nav-badge quiet">{count}</span>
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
 * at its start. The current page's row carries the selection over the whole row (LA-BRW-DR220).
 * Its link stretches over the row, so a click anywhere on it follows the link.
 */
function NavRow({ depth, selected = false, chevron, children }: { depth: number; selected?: boolean; chevron?: ReactNode; children: ReactNode }) {
  return (
    <div className={`nav-row${selected ? ' is-selected' : ''}`} style={{ '--depth': depth } as CSSProperties}>
      {chevron ?? <span className="nav-chevron-space" aria-hidden="true" />}
      {children}
    </div>
  );
}

/** A foldable nav row (a stage or a folder) with its count, holding its rows below it when open. The button is the row. */
function NavFolder({ id, depth, label, count, open, onToggle, stage = false, children }: { id: string; depth: number; label: string; count: number; open: boolean; onToggle: () => void; stage?: boolean; children: ReactNode }) {
  const bodyId = `nav-folder-${id.replace(/[^A-Za-z0-9_-]/g, '-')}`;
  return (
    <li className={`nav-folder${stage ? ' is-stage' : ''}`}>
      <button type="button" className="nav-folder-head nav-row" style={{ '--depth': depth } as CSSProperties} aria-expanded={open} aria-controls={bodyId} onClick={onToggle}>
        <Icon name={open ? 'chevron-down' : 'chevron-right'} size={14} />
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
