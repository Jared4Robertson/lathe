import { useMemo } from 'react';
import type { ColumnDescription } from '../../../lathe/src/platform/data/schema';
import { type RecordIndex } from '../exploring/record-summaries/record-index';
import { type MetaStage } from '../platform/meta-model/reads';
import type { Stage } from '../../../lathe/src/platform/data/schema';
import { pageHref } from '../views/overlays';
import type { Reference } from '../../../lathe/src/reference';
import type { ProductProblems } from '../../../lathe/src/checking/problems/read-model';
import { useRead } from '../record/read';

// The format reference in the app: every kind (its table and typed columns), relation, stage and
// check of this space, read from the meta model and the Reference read (GET /api/reference); and the links that open its pages, which open in the wiki card over the stage,
// the stage keeping its focus (`?page=format/kinds/use_case`, views/overlays.tsx).

/** A format page: the format itself, a kind's page or a check's page. */
export type FormatRoute = { page: 'format' } | { page: 'format-kind'; kind: string } | { page: 'format-check'; check: string };

/** The link that opens the record format in the wiki card. */
export const formatPath = pageHref('format');
export const kindPagePath = (kind: string) => pageHref(`format/kinds/${encodeURIComponent(kind)}`);
export const checkPagePath = (check: string) => pageHref(`format/checks/${encodeURIComponent(check)}`);

/** The format page a `page` parameter names (`format/kinds/use_case`), or null for none. */
export function parseFormatPage(value: string | null): FormatRoute | null {
  if (!value) return null;
  const parts = value.split('/').filter(Boolean).map((p) => { try { return decodeURIComponent(p); } catch { return p; } });
  if (parts[0] !== 'format') return null;
  if (parts.length === 1) return { page: 'format' };
  if (parts.length === 3 && parts[1] === 'kinds') return { page: 'format-kind', kind: parts[2] };
  if (parts.length === 3 && parts[1] === 'checks') return { page: 'format-check', check: parts[2] };
  return null;
}
/** The anchor of a kind page's columns, and of one column within it. */
export const FIELDS_ANCHOR = 'fields';
export const fieldAnchor = (field: string) => `field-${field}`;

/** A kind as the reference describes it: its table's columns, where it sits, and its ID convention. */
export interface KindReference {
  kind: string;
  label: string;
  description: string;
  /** Its stage, or null for the kinds outside the stages (the product, an open question). */
  stage: Stage | null;
  /** The kinds its records may sit under: none for a kind with no owner, two for an endpoint, a table and an open question. */
  parent_kinds: string[];
  /** The kinds that list this kind among their parents, in kind order. */
  child_kinds: string[];
  /** Its table's columns, in their order. */
  columns: ColumnDescription[];
  /** The part tables its records own (an entity's fields, a use case's steps). */
  parts: { table: string; description: string }[];
  /** Whether it is an obligation: designed, built and proved. */
  obligation: boolean;
  id: { pattern: string; example: string } | null;
  /** What its IDs start with: its product's, its domain's or its parent's ID; null for a product's own kind. */
  idScope: string | null;
  /** For a product's own kind, the product that declares it. */
  product: string | null;
}

export interface RelationReference {
  relation: string;
  source_kind: string;
  /** A kind, or '*' for any kind. */
  target_kind: string;
  role: 'design' | 'build' | 'proof' | '';
  description: string;
  forward_label: string;
  reverse_label: string;
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
  /** The kinds it concerns; empty when it concerns records of any kind. */
  kinds: string[];
}

export interface FormatReference {
  kinds: KindReference[];
  relations: RelationReference[];
  /** The five stages, in order. */
  stages: MetaStage[];
  /** The checks by their place, Lathe's before the product's, then the engine's own. */
  checks: CheckReference[];
}

const SEVERITIES: Record<Reference['checks'][number]['severity'], Severity[]> = { error: ['error'], warning: ['warning'], error_or_warning: ['error', 'warning'] };

/**
 * The format reference for a space: its kinds, relations and stages from the meta model (each kind's columns as its
 * fields' inputs take them), and each kind's ID convention and part tables and every check from the Reference read
 * (LA-AUT-RM01, GET /api/reference), which the schema and the check rows generate. A kind the Reference does not
 * describe (another product folder's own kind) has no ID convention or part tables there.
 */
export function referenceOf(index: RecordIndex, reference: Reference, problems: readonly { check: string; severity: Severity }[]): FormatReference {
  const described = new Map(reference.kinds.map((k) => [k.kind, k]));
  const partsOf = (kind: string) => reference.tables
    .filter((t) => t.role === 'part' && t.owner_column && t.columns.find((c) => c.name === t.owner_column)?.references === `${kind}.id`)
    .map((t) => ({ table: t.name, description: t.description }));
  const kinds: KindReference[] = index.meta.kindList.map((k) => {
    const ref = described.get(k.kind);
    return {
      kind: k.kind,
      label: k.label,
      description: k.description,
      stage: k.stage,
      parent_kinds: k.parent_kinds,
      child_kinds: index.meta.kindList.filter((c) => c.parent_kinds.includes(k.kind)).map((c) => c.kind),
      columns: index.meta.columns[k.kind] ?? [],
      parts: partsOf(k.kind),
      obligation: k.obligation,
      id: ref?.id ?? null,
      idScope: k.id_scope,
      product: k.declared_by,
    };
  });
  // The checks of the space: Lathe's, the engine's own, and the space's product's own.
  const checks: CheckReference[] = reference.checks
    .filter((c) => c.origin !== 'product' || c.product === index.product)
    .map((c) => {
      const severities = SEVERITIES[c.severity];
      return { check: c.check, severity: severities[0], severities, summary: c.summary, explanation: c.explanation, origin: c.origin, kinds: c.kinds };
    });
  // A problem of a check the Reference does not know is the engine's own.
  const known = new Set(checks.map((c) => c.check));
  const engine = new Map<string, Set<Severity>>();
  for (const p of problems) if (!known.has(p.check)) engine.set(p.check, (engine.get(p.check) ?? new Set()).add(p.severity));
  for (const [check, found] of [...engine].sort(([a], [b]) => a.localeCompare(b))) {
    const severities = (['error', 'warning'] as const).filter((s) => found.has(s));
    checks.push({ check, severity: severities[0], severities, summary: '', explanation: '', origin: 'engine', kinds: [] });
  }
  return { kinds, relations: index.meta.relations.map((r) => ({ ...r })), stages: index.meta.stages, checks };
}

/**
 * The format reference for the space: the Reference read again whenever the data is, joined with the meta model and
 * the space's problems (list-problems), whose checks with no row are the engine's own.
 */
export function useFormat(index: RecordIndex | null): FormatReference | null {
  const read = useRead<Reference>('/api/reference', index ? {} : null, index);
  const problems = useRead<ProductProblems>('/api/problems/list-problems', index ? { product_id: index.product } : null, index);
  return useMemo(() => {
    if (!index || read.state !== 'read') return null;
    const found = problems.state === 'read' ? [...problems.answer.own, ...problems.answer.workspace].flatMap((g) => g.problems) : [];
    return referenceOf(index, read.answer, found);
  }, [index, read, problems]);
}

// ---------- Lookups ----------

/** A stage's label from the reference ("Domain model"), or "Outside the stages" for none. */
export const stageName = (ref: FormatReference, stage: Stage | null) =>
  stage ? ref.stages.find((s) => s.stage === stage)?.label ?? stage : 'Outside the stages';

export const obligationText = (obligation: boolean) =>
  obligation ? 'An obligation: it must be designed, built and proved.' : 'Not an obligation: coverage does not count it.';
export const obligationShort = (obligation: boolean) => (obligation ? 'Designed, built and proved' : 'None');

export const ID_SCOPE_TEXT: Record<string, string> = {
  product: "Its product's ID and a hyphen",
  domain: "Its domain's ID and a hyphen",
  parent: "Its parent's ID and a hyphen",
};

export const ORIGIN_TEXT: Record<CheckReference['origin'], string> = {
  lathe: "Lathe's checks",
  product: "This product's own checks",
  engine: 'The engine itself',
};

export const findKind = (ref: FormatReference, kind: string) => ref.kinds.find((k) => k.kind === kind);
export const findCheck = (ref: FormatReference, check: string) => ref.checks.find((c) => c.check === check);

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
