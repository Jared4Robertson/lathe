// Each interface's version of a flow, derived and never stored (LA-UCS-RM11): a use case has one flow, the same through
// every interface that offers it, and the interface's kind and pattern say how each step is carried out there. Its
// version leaves out the other interfaces' variants and, for each step that invokes a command or query, names where it
// is carried out: the views that present it (a web app or desktop: views of every such interface, or of this one), the
// endpoints that expose it (an API), or the records of the product's own interface design kinds under it or that
// present it (a CLI or agent tools, such as Lathe's CLI commands or an invocation that carries out several commands:
// one that sits under an interface reaches only that one). An interface of kind other reaches its operations in a way
// no record says. Its actor is the first of the use case's actors the interface lists (the use case's main actor when it lists
// none), and how it reaches a step's command or query and shows a refusal is what the rules of the patterns it follows
// say. The Use case read model and the Trace read model read the same answer; the step-unreached check says it in SQL.
import type { ReadView } from '../../platform/data/rules.ts';
import type { Row } from '../../platform/data/rows.ts';

/** A step as it reaches the interface's version: its place, whether it is another interface's variant, and what it invokes. */
export interface StepToCarry {
  id: string;
  path: string;
  position: number;
  /** The interface it is a variant of, or null when every interface does it. */
  variantOf: string | null;
  operation: string | null;
}

/** One step as an interface carries it out. */
export interface StepThrough {
  id: string;
  /** Where it is carried out, by ID: views, endpoints or the product's own records; empty when nothing reaches it or it invokes nothing. */
  reach: string[];
  /** True when it invokes a command or query this interface has no way to reach. */
  unreached: boolean;
}

/** A flow as one interface carries it out. */
export interface FlowThrough {
  interface: string;
  /** The interface's kind, such as web app or CLI. */
  kind: string;
  /** The role who carries it out there, or null when the use case names no actor. */
  actor: string | null;
  /** The patterns the interface follows. */
  patterns: string[];
  /** The rules of those patterns, which say how it reaches a step's command or query and shows a refusal. */
  rules: string[];
  /** Its steps, path by path (main first, then the others by name), each by position, with the other interfaces' variants left out. */
  paths: { name: string; steps: StepThrough[] }[];
}

const VIEW_KINDS = new Set(['web app', 'desktop']);
const OWN_KINDS = new Set(['CLI', 'agent tools']);

const grouped = (rows: Row[], key: string, value: string): Map<string, string[]> => {
  const by = new Map<string, string[]>();
  for (const r of rows) {
    const k = r[key];
    const v = r[value];
    if (typeof k !== 'string' || typeof v !== 'string') continue;
    by.set(k, [...(by.get(k) ?? []), v]);
  }
  return by;
};

/**
 * The versions of flows, worked out over the data: `of(useCase, actors, steps)` gives each interface that offers the use
 * case its version, by interface ID.
 */
export function interfaceVersions(view: Pick<ReadView, 'rows' | 'schema'>): (useCase: string, actors: readonly string[], steps: readonly StepToCarry[]) => FlowThrough[] {
  const rows = (table: string): Row[] => (view.schema.tables[table] ? view.rows(table) : []);
  const interfaces = new Map(rows('interface').map((i) => [String(i.id), i]));
  const offeredBy = grouped(rows('offers'), 'target_id', 'source_id');
  const actorsOf = new Map<string, string[]>();
  for (const a of [...rows('interface_actor')].sort((x, y) => Number(x.position) - Number(y.position))) {
    actorsOf.set(String(a.interface_id), [...(actorsOf.get(String(a.interface_id)) ?? []), String(a.role_name)]);
  }
  const follows = grouped(rows('follows'), 'source_id', 'target_id');
  const rulesOf = grouped(rows('pattern_rule'), 'pattern_id', 'id');
  const viewInterface = new Map(rows('view').map((v) => [String(v.id), typeof v.interface_id === 'string' ? v.interface_id : null]));
  const presentedIn = grouped(rows('presents'), 'target_id', 'source_id');
  const endpointsOf = new Map<string, string[]>();
  for (const e of rows('endpoint')) {
    const operation = String(e.command_id ?? e.query_id ?? '');
    endpointsOf.set(operation, [...(endpointsOf.get(operation) ?? []), String(e.id)]);
  }
  // The records of the product's own interface design kinds under a command or a query (a CLI command), and those
  // that present it (an invocation that carries out several), each with the one interface it sits under, if it does.
  const ownOf = new Map<string, string[]>();
  const ownInterface = new Map<string, string | null>();
  for (const kind of Object.values(view.schema.kinds)) {
    if (kind.productId === null || kind.obligation || kind.stage !== 'interface-design') continue;
    const under = kind.parents.find((p) => p.kind === 'interface')?.column;
    for (const r of rows(kind.name)) ownInterface.set(String(r.id), under && typeof r[under] === 'string' ? r[under] : null);
    for (const parent of kind.parents) {
      if (parent.kind !== 'command' && parent.kind !== 'query') continue;
      for (const [operation, ids] of grouped(rows(kind.name), parent.column, 'id')) ownOf.set(operation, [...(ownOf.get(operation) ?? []), ...ids]);
    }
  }
  for (const [operation, sources] of presentedIn) {
    const own = sources.filter((id) => ownInterface.has(id));
    if (own.length) ownOf.set(operation, [...new Set([...(ownOf.get(operation) ?? []), ...own])]);
  }

  /** Where the interface carries out a step that invokes the operation; null when no record of it can say (other). */
  const reachOf = (face: string, kind: string, operation: string): string[] | null => {
    if (VIEW_KINDS.has(kind)) return (presentedIn.get(operation) ?? []).filter((v) => { const only = viewInterface.get(v); return viewInterface.has(v) && (!only || only === face); }).sort();
    if (kind === 'API') return [...(endpointsOf.get(operation) ?? [])].sort();
    if (OWN_KINDS.has(kind)) return (ownOf.get(operation) ?? []).filter((r) => { const only = ownInterface.get(r); return !only || only === face; }).sort();
    return null;
  };

  return (useCase, actors, steps) =>
    [...(offeredBy.get(useCase) ?? [])].sort().flatMap((face) => {
      const row = interfaces.get(face);
      if (!row) return [];
      const kind = String(row.kind);
      const uses = actorsOf.get(face) ?? [];
      const patterns = [...(follows.get(face) ?? [])].sort();
      const byPath = new Map<string, StepThrough[]>();
      for (const s of [...steps].filter((x) => x.variantOf === null || x.variantOf === face).sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))) {
        const reach = s.operation ? reachOf(face, kind, s.operation) : [];
        const path = s.path.trim().toLowerCase() || 'main';
        byPath.set(path, [...(byPath.get(path) ?? []), { id: s.id, reach: reach ?? [], unreached: reach !== null && s.operation !== null && reach.length === 0 }]);
      }
      return [
        {
          interface: face,
          kind,
          actor: (uses.length ? actors.find((a) => uses.includes(a)) : actors[0]) ?? null,
          patterns,
          rules: patterns.flatMap((p) => rulesOf.get(p) ?? []).sort(),
          paths: [...byPath].sort(([a], [b]) => (a === 'main' ? -1 : b === 'main' ? 1 : a.localeCompare(b))).map(([name, list]) => ({ name, steps: list })),
        },
      ];
    });
}
