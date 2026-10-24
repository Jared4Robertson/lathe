import { Link } from '../router';

// The graph view's address and its entry points. Kept apart from GraphPage so the menu and the
// spec pages can link to the graph without loading React Flow and ELK.

export const GRAPH_ROOT = '/graph';
export const graphPath = (id: string) => `${GRAPH_ROOT}/${encodeURIComponent(id)}`;

/** The focused record for a graph address: an ID, null for `/graph` itself, or undefined for any other path. */
export function parseGraphPath(pathname: string): string | null | undefined {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] !== 'graph') return undefined;
  if (parts.length === 1) return null;
  return parts.slice(1).map(decodeURIComponent).join('/');
}

/** The Graph item in the main menu. */
export function GraphMenu({ path }: { path: string }) {
  const here = parseGraphPath(path) !== undefined;
  return (
    <>
      <p className="eyebrow">Graph</p>
      <ul>
        <li>
          <Link to={GRAPH_ROOT} aria-current={here ? 'page' : undefined}>Graph</Link>
        </li>
      </ul>
    </>
  );
}

/** The "Open in graph" link on record and domain pages. */
export function OpenInGraph({ id }: { id: string }) {
  return <Link to={graphPath(id)} className="open-in-graph">Open in graph</Link>;
}
