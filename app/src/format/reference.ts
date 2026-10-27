import { useMemo } from 'react';
import type { ColumnDescription } from '../../../lathe/src/store/schema';
import { formatPath, kindOrder, partTablesOf, textOf, type SpecIndex, type Workspace } from '../specs/data';

// The format reference in the app: every kind (its table and typed columns), relation, folder and
// check of this space, read from the schema the server serves with the data and from the check
// table's rows; and the addresses of the pages that show it.

export { formatPath };
export const kindPagePath = (kind: string) => `${formatPath}/kinds/${encodeURIComponent(kind)}`;
export const checkPagePath = (check: string) => `${formatPath}/checks/${encodeURIComponent(check)}`;
/** The anchor of a kind page's columns, and of one column within it. */
export const FIELDS_ANCHOR = 'fields';
export const fieldAnchor = (field: string) => `field-${field}`;
export const kindFieldPath = (kind: string, field?: string) => `${kindPagePath(kind)}#${field ? fieldAnchor(field) : FIELDS_ANCHOR}`;

/** A kind as the reference describes it: its table's columns, where it sits, and its ID convention. */
export interface KindReference {
  kind: string;
  label: string;
  description: string;
  /** 'define', 'design', or '' for the kinds outside the stages. */
  stage: string;
  /** The folder the kind sits in, or ''. */
  section: string;
  parent_kinds: string[];
  /** The kinds that list this kind among their parents, in kind order. */
  child_kinds: string[];
  /** Its table's columns, in their order. */
  columns: ColumnDescription[];
  /** The part tables its records own (an entity's fields, a use case's steps). */
  parts: { table: string; description: string }[];
  /** 'yes': designed, built and proved; 'proof': proved only; 'no': not an obligation. */
  obligation: 'yes' | 'proof' | 'no';
  id: { pattern: string; example: string } | null;
  /** For a product's own kind, the product that declares it. */
  product: string | null;
}

export interface RelationReference {
  relation: string;
  source_kind: string;
  /** A kind, or '*' for any kind. */
  target_kind: string;
  role: 'design' | 'proof' | '';
  description: string;
  forward_label: string;
  reverse_label: string;
}

export interface SectionReference {
  section: string;
  stage: string;
  order: number;
  label: string;
  description: string;
}

export type Severity = 'error' | 'warning';

export interface CheckReference {
  /** The check's name, as problems carry it. */
  check: string;
  /** The highest severity it reports. */
  severity: Severity;
  severities: Severity[];
  /** What the check asks, in one sentence. */
  summary: string;
  /** What it reports and how to fix it, as Markdown. */
  explanation: string;
  /** Lathe's own checks, the product's, or the engine itself (a problem whose check has no row). */
  origin: 'lathe' | 'product' | 'engine';
  /** The query it runs, or '' for the engine's own. */
  query: string;
  /** The kinds it concerns; empty when it concerns records of any kind. */
  kinds: string[];
}

export interface FormatReference {
  kinds: KindReference[];
  relations: RelationReference[];
  /** The folders, in stage then order. */
  sections: SectionReference[];
  /** The checks by their place, Lathe's before the product's, then the engine's own. */
  checks: CheckReference[];
}

const SEVERITIES: Record<string, Severity[]> = { error: ['error'], warning: ['warning'], error_or_warning: ['error', 'warning'] };

/** The reference for a workspace: its schema's kinds, relations and folders, and its check rows. */
export function referenceOf(workspace: Workspace): FormatReference {
  const { schema } = workspace;
  const kinds: KindReference[] = workspace.kinds.map((k) => {
    const described = schema.kinds[k.kind];
    const table = schema.tables[k.kind];
    return {
      kind: k.kind,
      label: k.label,
      description: k.description,
      stage: k.stage,
      section: k.section,
      parent_kinds: k.parent_kinds,
      child_kinds: workspace.kinds.filter((c) => c.parent_kinds.includes(k.kind)).map((c) => c.kind),
      columns: table?.columns ?? [],
      parts: partTablesOf(schema, k.kind).map((t) => ({ table: t, description: schema.tables[t].description ?? '' })),
      obligation: k.proof_only ? 'proof' : k.obligation ? 'yes' : 'no',
      id: described?.idPattern ? { pattern: described.idPattern, example: described.idExample ?? '' } : null,
      product: described?.productId ?? null,
    };
  });
  const rows = [...workspace.checks].sort((a, b) =>
    (a.product_id === undefined ? 0 : 1) - (b.product_id === undefined ? 0 : 1) || Number(a.position) - Number(b.position));
  const checks: CheckReference[] = rows.map((c) => {
    const severities = SEVERITIES[textOf(c, 'severity')] ?? ['error'];
    return {
      check: textOf(c, 'name'),
      severity: severities[0],
      severities,
      summary: textOf(c, 'summary'),
      explanation: textOf(c, 'explanation'),
      origin: c.product_id === undefined ? 'lathe' : 'product',
      query: textOf(c, 'query'),
      kinds: Array.isArray(c.kinds) ? [...c.kinds].sort(kindOrder) : [],
    };
  });
  // A problem of a check with no row is the engine's own.
  const known = new Set(checks.map((c) => c.check));
  const engine = new Map<string, Set<Severity>>();
  for (const p of workspace.problems) {
    if (known.has(p.check)) continue;
    engine.set(p.check, (engine.get(p.check) ?? new Set()).add(p.severity));
  }
  for (const [check, found] of [...engine].sort(([a], [b]) => a.localeCompare(b))) {
    const severities = (['error', 'warning'] as const).filter((s) => found.has(s));
    checks.push({ check, severity: severities[0], severities, summary: '', explanation: '', origin: 'engine', query: '', kinds: [] });
  }
  return {
    kinds,
    relations: workspace.relations.map((r) => ({ ...r })),
    sections: workspace.sections,
    checks,
  };
}

/** The format reference for the loaded data (the space's, when the index is a space's). */
export function useFormat(index: SpecIndex | null): FormatReference | null {
  const workspace = index?.workspace ?? null;
  return useMemo(() => (workspace ? referenceOf(workspace) : null), [workspace]);
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

/** The checks whose row names the kind among its kinds. */
export const checksOf = (ref: FormatReference, kind: string) => ref.checks.filter((c) => c.kinds.includes(kind));

/** A relation's words, read from the source or from the target, falling back to its name. */
export const relationWords = (r: RelationReference, from: 'source' | 'target') =>
  (from === 'source' ? r.forward_label : r.reverse_label) || r.relation.replaceAll('_', ' ');

/** A column's type as the reference writes it: text, whole number, true or false, a date, one of an enum's values, or a list of texts. */
export function columnType(column: ColumnDescription): string {
  switch (column.kind) {
    case 'text': return 'text';
    case 'integer': return 'whole number';
    case 'boolean': return 'true or false';
    case 'date': return 'date (YYYY-MM-DD)';
    case 'enum': return `one of ${(column.values ?? []).join(', ')}`;
    case 'text_list': return 'list of texts';
  }
}
