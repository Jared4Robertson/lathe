import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import concepts from '../../../lathe/FORMAT.md?raw';
import type { CheckReference, FormatReference, KindReference, RelationReference, SectionReference } from '../../../lathe/src/reference';
import { onLatheEvent } from '../events';
import { formatPath, type SpecIndex, type Workspace } from '../specs/data';

export type { CheckReference, FormatReference, KindReference, RelationReference, SectionReference };

// The format reference in the app: what the engine serves at GET /api/format (every kind, relation,
// folder and check of this product, with its extensions and its own checks), and the addresses of
// the pages that show it. When the engine does not serve it (the sample fixture, or a test), the
// app builds what it can from the loaded workspace, without the check explanations.

export { formatPath };
export const kindPagePath = (kind: string) => `${formatPath}/kinds/${encodeURIComponent(kind)}`;
export const checkPagePath = (check: string) => `${formatPath}/checks/${encodeURIComponent(check)}`;
/** The anchor of a kind page's fields, and of one required field within it. */
export const FIELDS_ANCHOR = 'fields';
export const fieldAnchor = (field: string) => `field-${field}`;
export const kindFieldPath = (kind: string, field?: string) => `${kindPagePath(kind)}#${field ? fieldAnchor(field) : FIELDS_ANCHOR}`;

export interface FormatState {
  /** The reference, from the engine or built from the workspace. Null until the specs load. */
  reference: FormatReference | null;
  /** 'engine' when GET /api/format answered; 'workspace' when the app built it from the workspace. */
  source: 'engine' | 'workspace' | null;
}

/**
 * The reference as far as the workspace tells it: its kinds, relations and folders, and a check for
 * each check name a problem carries, with no explanation or source.
 */
export function referenceFromWorkspace(workspace: Workspace): FormatReference {
  const kinds: KindReference[] = workspace.kinds.map((k) => ({
    kind: k.kind,
    label: k.label,
    description: k.description,
    stage: k.stage,
    section: k.section,
    parent_kinds: k.parent_kinds,
    child_kinds: workspace.kinds.filter((c) => c.parent_kinds.includes(k.kind)).map((c) => c.kind),
    required_fields: k.required_fields,
    obligation: k.proof_only ? 'proof' : k.obligation ? 'yes' : 'no',
    id: null,
  }));
  const checks = new Map<string, CheckReference>();
  for (const p of workspace.problems) {
    const known = checks.get(p.check);
    const severities = [...new Set([...(known?.severities ?? []), p.severity])];
    const ordered = (['error', 'warning'] as const).filter((s) => severities.includes(s));
    checks.set(p.check, { check: p.check, severity: ordered[0], severities: ordered, summary: '', explanation: '', origin: 'lathe', source: '', kinds: [] });
  }
  return {
    concepts,
    kinds,
    relations: workspace.relations.map((r) => ({ ...r })),
    sections: workspace.sections,
    checks: [...checks.values()].sort((a, b) => a.check.localeCompare(b.check)),
  };
}

const isReference = (v: unknown): v is FormatReference =>
  !!v && typeof v === 'object' && Array.isArray((v as FormatReference).kinds) && Array.isArray((v as FormatReference).checks);

interface FormatStore {
  engine: FormatReference | null;
  /** Asks for the reference; it is fetched once, then again when the specs change. */
  want: () => void;
}

const FormatContext = createContext<FormatStore | null>(null);
export const FormatProvider = FormatContext.Provider;

/** The shell's store of the reference: nothing is fetched until a page or quick find wants it. */
export function useFormatStore(): FormatStore {
  const [engine, setEngine] = useState<FormatReference | null>(null);
  const [wanted, setWanted] = useState(false);
  const asked = useRef(false);
  const want = useCallback(() => {
    if (asked.current) return;
    asked.current = true;
    setWanted(true);
  }, []);
  useEffect(() => {
    if (!wanted) return;
    let live = true;
    const load = async () => {
      try {
        const response = await fetch('/api/format');
        const body = response.ok ? await response.json() : null;
        if (live) setEngine(isReference(body) ? body : null);
      } catch {
        if (live) setEngine(null);
      }
    };
    load();
    const off = onLatheEvent('spec:changed', load);
    return () => { live = false; off(); };
  }, [wanted]);
  return useMemo(() => ({ engine, want }), [engine, want]);
}

/** The format reference for the loaded specs: the engine's, or one built from the workspace. */
export function useFormat(index: SpecIndex | null, enabled = true): FormatState {
  const store = useContext(FormatContext);
  useEffect(() => { if (enabled) store?.want(); }, [enabled, store]);
  const workspace = index?.workspace ?? null;
  const built = useMemo(() => (workspace ? referenceFromWorkspace(workspace) : null), [workspace]);
  if (store?.engine) return { reference: store.engine, source: 'engine' };
  return { reference: built, source: built ? 'workspace' : null };
}

// ---------- Lookups ----------

export const STAGE_LABELS: Record<string, string> = { define: 'Define', design: 'Design', '': 'Product level' };
export const stageName = (stage: string) => STAGE_LABELS[stage] ?? stage;

export const OBLIGATION_TEXT: Record<KindReference['obligation'], string> = {
  yes: 'An obligation: it must be designed (satisfied), built and proved.',
  proof: 'An obligation that needs proof only: a test must prove it.',
  no: 'Not an obligation: coverage does not count it.',
};
export const OBLIGATION_SHORT: Record<KindReference['obligation'], string> = { yes: 'Designed, built and proved', proof: 'Proved only', no: 'None' };

export const ORIGIN_TEXT: Record<CheckReference['origin'], string> = {
  lathe: "Lathe's checks",
  product: "This product's own checks",
  engine: 'The engine itself',
};

export const findKind = (ref: FormatReference, kind: string) => ref.kinds.find((k) => k.kind === kind);
export const findCheck = (ref: FormatReference, check: string) => ref.checks.find((c) => c.check === check);
export const sectionOf = (ref: FormatReference, kind: KindReference) => ref.sections.find((s) => s.section === kind.section);

/** The relations a kind's records link out by (it is the source) and are linked by (it is the target, or any kind is). */
export function relationsOf(ref: FormatReference, kind: string): { out: RelationReference[]; in: RelationReference[] } {
  return {
    out: ref.relations.filter((r) => r.source_kind === kind),
    in: ref.relations.filter((r) => r.target_kind === kind || r.target_kind === '*'),
  };
}

/** The checks that name the kind in their `kinds:` header line. */
export const checksOf = (ref: FormatReference, kind: string) => ref.checks.filter((c) => c.kinds.includes(kind));

/** A relation's words, read from the source or from the target, falling back to its name. */
export const relationWords = (r: RelationReference, from: 'source' | 'target') =>
  (from === 'source' ? r.forward_label : r.reverse_label) || r.relation.replaceAll('_', ' ');
