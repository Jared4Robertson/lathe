import { forwardRef, useEffect, useRef, type ReactNode } from 'react';
import { Icon } from '../components/icons';
import { LongList } from '../components/LongList';
import { LatheLogo } from '../LatheLogo';
import { Link } from '../router';
import { checksPath, domainPath, formatPath, productPath, type SpecState } from '../specs/data';
import { recordText } from '../specs/parts';
import type { DiagramSummary } from '../types';
import { useShortcut } from './commands';
import { isBool, usePref } from './prefs';
import { QuickFind } from './QuickFind';

// The side navigation: a quick find at the top, then Diagrams, Specs and tools, each a section
// that folds on its own, and a footer with the record format and where the specs come from. It
// collapses to a rail of icons (remembered), and on a narrow screen it is a drawer.

export interface NavProps {
  spec: SpecState;
  path: string;
  diagrams: readonly DiagramSummary[];
  diagramError: string | null;
  /** The form or button for a new diagram. */
  newDiagram: ReactNode;
  /** Where the Graph item goes: this page in the Graph view, or the first product's. */
  graphHref: string;
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
const PRODUCTS_KEY = 'lathe:nav-products';
const isOpenMap = (v: unknown): v is Record<string, boolean> => !!v && typeof v === 'object' && !Array.isArray(v) && Object.values(v).every(isBool);

const here = (path: string, to: string) => (path === to ? 'page' : undefined);

/** Which section holds the current page. */
function sectionOf(path: string): SectionId | null {
  if (path.startsWith('/diagrams')) return 'diagrams';
  if (path.startsWith('/specs') || path.startsWith('/records')) return 'specs';
  if (path.startsWith('/checks')) return 'tools';
  return null;
}

export const Nav = forwardRef<HTMLElement, NavProps>(function Nav(props, ref) {
  const { spec, path, diagrams, diagramError, newDiagram, graphHref, collapsed, onToggleCollapsed, drawer, drawerOpen, onCloseDrawer, findRef } = props;
  const { index } = spec;
  const [sections, setSections] = usePref<Record<string, boolean>>(SECTIONS_KEY, {}, isOpenMap);
  const [products, setProducts] = usePref<Record<string, boolean>>(PRODUCTS_KEY, {}, isOpenMap);
  const isOpen = (id: SectionId) => sections[id] !== false;
  const toggle = (id: SectionId) => setSections((s) => ({ ...s, [id]: !(s[id] !== false) }));
  const productOpen = (id: string) => products[id] !== false;
  const scroller = useRef<HTMLDivElement>(null);
  const navShortcut = useShortcut('toggleNav');

  // The section and product holding the current page open themselves.
  const currentProduct = path.match(/^\/specs\/([^/]+)/)?.[1];
  const current = sectionOf(path);
  useEffect(() => {
    if (current) setSections((s) => (s[current] === false ? { ...s, [current]: true } : s));
    if (currentProduct) {
      const id = decodeURIComponent(currentProduct);
      setProducts((p) => (p[id] === false ? { ...p, [id]: true } : p));
    }
  }, [current, currentProduct, setSections, setProducts]);

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

  const className = ['menu', collapsed && !drawer ? 'is-rail' : '', drawer ? 'is-drawer' : '', drawer && drawerOpen ? 'is-open' : ''].filter(Boolean).join(' ');

  if (collapsed && !drawer) {
    return (
      <nav ref={ref} className={className} aria-label="Main" id="nav">
        <div className="rail">
          <Link to="/specs" className="rail-item brand-mark" aria-label="Lathe home" title="Lathe"><LatheLogo size={24} /></Link>
          <button type="button" className="rail-item" aria-label="Expand the navigation" aria-expanded={false} aria-controls="nav" title={`Expand the navigation${navShortcut ? ` (${navShortcut})` : ''}`} onClick={onToggleCollapsed}>
            <Icon name="sidebar-left" />
          </button>
          <button type="button" className="rail-item" aria-label="Quick find" title="Quick find" onClick={() => { onToggleCollapsed(); setTimeout(() => findRef.current?.focus(), 0); }}>
            <Icon name="search" />
          </button>
          <button type="button" className="rail-item" aria-label="Diagrams" title="Diagrams" aria-current={current === 'diagrams' ? 'true' : undefined} onClick={() => { setSections((s) => ({ ...s, diagrams: true })); onToggleCollapsed(); }}>
            <Icon name="diagrams" />
          </button>
          <button type="button" className="rail-item" aria-label="Specs" title="Specs" aria-current={current === 'specs' ? 'true' : undefined} onClick={() => { setSections((s) => ({ ...s, specs: true })); onToggleCollapsed(); }}>
            <Icon name="specs" />
          </button>
          <Link to={checksPath} className="rail-item" aria-label={checksLabel} title={checksLabel} aria-current={here(path, checksPath)}>
            <Icon name="checks" />
            {errors > 0 ? <span className="rail-dot error" /> : warnings > 0 ? <span className="rail-dot warning" /> : null}
          </Link>
          <Link to={graphHref} className="rail-item" aria-label="Graph" title="Graph: this page in the graph">
            <Icon name="graph" />
          </Link>
          <Link to={formatPath} className="rail-item" aria-label="Record format" title="Record format" aria-current={here(path, formatPath)}>
            <Icon name="format" />
          </Link>
        </div>
      </nav>
    );
  }

  return (
    <nav
      ref={ref}
      className={className}
      aria-label="Main"
      id="nav"
      onKeyDown={drawer ? (e) => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); onCloseDrawer(); } } : undefined}
    >
      <div className="nav-head">
        <Link to="/specs" className="brand"><LatheLogo /> <span>Lathe</span></Link>
        <button
          type="button"
          className="icon-button"
          aria-label={drawer ? 'Close the navigation' : 'Collapse the navigation'}
          aria-expanded={true}
          aria-controls="nav"
          title={`${drawer ? 'Close' : 'Collapse'} the navigation${navShortcut ? ` (${navShortcut})` : ''}`}
          onClick={drawer ? onCloseDrawer : onToggleCollapsed}
        >
          <Icon name={drawer ? 'x' : 'sidebar-left'} />
        </button>
      </div>
      <QuickFind ref={findRef} index={index} diagrams={diagrams} />
      <div className="nav-scroll" ref={scroller}>
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
        <NavSection id="specs" icon="specs" title="Specs" count={index?.products.length} open={isOpen('specs')} onToggle={() => toggle('specs')}>
          {spec.error && !index && <p className="error">{spec.error}</p>}
          {index && (
            <ul>
              {index.products.map((product) => {
                const domains = index.domainsOf.get(product.id) ?? [];
                const open = productOpen(product.id);
                const inProduct = currentProduct !== undefined && decodeURIComponent(currentProduct) === product.id;
                return (
                  <li key={product.id} className={inProduct ? 'in-current' : undefined}>
                    <div className="nav-row">
                      {domains.length > 0 ? (
                        <button
                          type="button"
                          className="nav-chevron"
                          aria-expanded={open}
                          aria-label={`${open ? 'Hide' : 'Show'} the domains of ${product.title}`}
                          onClick={() => setProducts((p) => ({ ...p, [product.id]: !open }))}
                        >
                          <Icon name={open ? 'chevron-down' : 'chevron-right'} size={14} />
                        </button>
                      ) : <span className="nav-chevron-space" />}
                      <Link to={productPath(product.id)} aria-current={here(path, productPath(product.id))} title={product.title}>
                        <span className="nav-label">{product.title}</span>
                      </Link>
                    </div>
                    {domains.length > 0 && open && (
                      <LongList
                        label={`Domains of ${product.title}`}
                        className="submenu"
                        items={domains}
                        itemKey={(d) => d.id}
                        searchText={recordText}
                        render={(domain) => (
                          <Link to={domainPath(product.id, domain.id)} aria-current={here(path, domainPath(product.id, domain.id))} title={domain.title}>
                            <span className="nav-label">{domain.title}</span>
                          </Link>
                        )}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </NavSection>
        <NavSection id="tools" icon="checks" title="Tools" open={isOpen('tools')} onToggle={() => toggle('tools')}>
          <ul>
            <li>
              <Link to={checksPath} aria-current={here(path, checksPath)} aria-label={checksLabel}>
                <Icon name="checks" size={16} /> <span className="nav-label">Checks</span> {checkBadges}
              </Link>
            </li>
            <li>
              <Link to={graphHref} title="This page in the graph">
                <Icon name="graph" size={16} /> <span className="nav-label">Graph</span>
              </Link>
            </li>
          </ul>
        </NavSection>
      </div>
      <footer className="nav-foot">
        <Link to={formatPath} aria-current={here(path, formatPath)}><Icon name="format" size={16} /> <span className="nav-label">Record format</span></Link>
        <p className={`nav-source ${spec.source === 'fixture' ? 'is-fixture' : ''}`}>{sourceNote}</p>
      </footer>
    </nav>
  );
});

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
