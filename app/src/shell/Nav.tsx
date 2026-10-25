import { forwardRef, useEffect, useRef, type ReactNode } from 'react';
import { Icon } from '../components/icons';
import { LongList } from '../components/LongList';
import { childKinds, pluralLabel } from '../graph/model';
import { LatheLogo } from '../LatheLogo';
import { Link } from '../router';
import { byIdOrder, checksPath, domainPath, formatPath, groupPath, productPath, recordPath, type SpecIndex, type SpecRecord, type SpecState } from '../specs/data';
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
// domains (with their capabilities) and groups, then Diagrams and Tools, each a section that
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

type SectionId = 'diagrams' | 'specs' | 'tools';
const SECTIONS_KEY = 'lathe:nav-sections';
const isOpenMap = (v: unknown): v is Record<string, boolean> => !!v && typeof v === 'object' && !Array.isArray(v) && Object.values(v).every(isBool);

const here = (path: string, to: string) => (path === to ? 'page' : undefined);

/** Which section holds the current page. */
function sectionOf(path: string): SectionId | null {
  if (path.startsWith('/diagrams')) return 'diagrams';
  if (path.startsWith('/specs') || path.startsWith('/records')) return 'specs';
  if (path.startsWith('/checks')) return 'tools';
  return null;
}

/** A domain's capabilities in their order (as numbers), then by ID. */
export function capabilitiesOf(index: SpecIndex, domain: string): SpecRecord[] {
  const order = (r: SpecRecord) => { const n = Number(r.fields.order); return Number.isInteger(n) ? n : Infinity; };
  return (index.children.get(domain) ?? []).filter((r) => r.kind === 'capability').sort((a, b) => order(a) - order(b) || byIdOrder(a, b));
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

  const className = ['menu', 'has-spaces', collapsed && !drawer ? 'is-rail' : '', drawer ? 'is-drawer' : '', drawer && drawerOpen ? 'is-open' : ''].filter(Boolean).join(' ');
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
      onKeyDown={drawer ? (e) => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); onCloseDrawer(); } } : undefined}
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
          <NavSection id="specs" icon="specs" title={space?.title ?? 'Specs'} count={space && index ? index.domainsOf.get(space.id)?.length ?? 0 : undefined} open={isOpen('specs')} onToggle={() => toggle('specs')}>
            {spec.error && !index && <p className="error">{spec.error}</p>}
            {index && space && <SpaceItems index={index} space={space} path={path} />}
            {index && !space && <p className="hint">No products yet.</p>}
          </NavSection>
          <NavSection id="diagrams" icon="diagrams" title="Diagrams" count={diagrams.length} open={isOpen('diagrams')} onToggle={() => toggle('diagrams')}>
            <ul>
              {diagrams.map((d) => (
                <li key={d.slug}>
                  <Link to={`/diagrams/${d.slug}`} aria-current={here(path, `/diagrams/${d.slug}`)} title={d.title}>
                    <span className="nav-label">{d.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
            {diagramError && <p className="error">{diagramError}</p>}
            {newDiagram}
          </NavSection>
          <NavSection id="tools" icon="checks" title="Tools" open={isOpen('tools')} onToggle={() => toggle('tools')}>
            <ul>
              <li>
                <Link to={checksPath} aria-current={here(path, checksPath)} aria-label={checksLabel}>
                  <Icon name="checks" size={16} /> <span className="nav-label">Checks</span> {checkBadges}
                </Link>
              </li>
            </ul>
          </NavSection>
        </div>
        <footer className="nav-foot">
          <Link to={formatPath} aria-current={here(path, formatPath)}><Icon name="format" size={16} /> <span className="nav-label">Record format</span></Link>
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

/** The current space in the panel: its overview, its domains with their capabilities, and its groups. */
function SpaceItems({ index, space, path }: { index: SpecIndex; space: Space; path: string }) {
  const domains = index.domainsOf.get(space.id) ?? [];
  const groups = childKinds(index, space.id).filter((k) => k !== 'domain');
  return (
    <div className="space-items" data-space={space.id}>
      <ul>
        <li>
          <Link to={productPath(space.id)} aria-current={here(path, productPath(space.id))} title={space.title}>
            <SpaceMark space={space} size={18} /> <span className="nav-label">{space.title}</span>
          </Link>
        </li>
      </ul>
      {domains.length > 0 && (
        <LongList
          label={`Domains of ${space.title}`}
          className="submenu"
          items={domains}
          itemKey={(d) => d.id}
          searchText={recordText}
          render={(domain) => {
            const capabilities = capabilitiesOf(index, domain.id);
            return (
              <>
                <Link to={domainPath(space.id, domain.id)} aria-current={here(path, domainPath(space.id, domain.id))} title={domain.title}>
                  <span className="nav-label">{domain.title}</span>
                </Link>
                {capabilities.length > 0 && (
                  <ul className="nav-capabilities" aria-label={`Capabilities of ${domain.title}`}>
                    {capabilities.map((c) => (
                      <li key={c.id}>
                        <Link to={recordPath(c.id)} aria-current={here(path, recordPath(c.id))} title={c.title}>
                          <span className="nav-label">{c.title}</span>
                        </Link>
                      </li>
                    ))}
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
                <Link to={to} aria-current={here(path, to)}>
                  <span className="nav-label">{pluralLabel(index, kind)}</span> <span className="nav-badge quiet">{count}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function NavSection({ id, icon, title, count, open, onToggle, children }: { id: string; icon: string; title: string; count?: number; open: boolean; onToggle: () => void; children: ReactNode }) {
  const bodyId = `nav-section-${id}`;
  return (
    <section className="nav-section" aria-labelledby={`${bodyId}-head`}>
      <button type="button" id={`${bodyId}-head`} className="nav-section-head" aria-expanded={open} aria-controls={bodyId} onClick={onToggle}>
        <Icon name={open ? 'chevron-down' : 'chevron-right'} size={14} />
        <Icon name={icon} size={16} />
        <span className="eyebrow">{title}</span>
        {count !== undefined && <span className="nav-badge quiet">{count}</span>}
      </button>
      {open && <div id={bodyId} className="nav-section-body">{children}</div>}
    </section>
  );
}
