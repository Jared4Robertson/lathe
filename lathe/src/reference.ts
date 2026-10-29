// The reference: the stages, every kind with its table's columns, every other table, every relation, every check and
// every coverage gap, read from the schema description, the check table's rows and the engine's coverage rules, so the
// reference is generated rather than kept by hand. buildReference(root) in index.ts builds it for a product (with its
// own kinds, relations and checks); renderReference writes it as Markdown, by stage, as lathe/REFERENCE.md holds it
// (`npm --prefix lathe run reference`).
import { ALLOWED_LEVELS, GAP_RULES, OBLIGATION_COVERAGE } from './coverage.ts';
import type { ColumnDescription, IdScope, KindDescription, SchemaDescription, Stage, TableDescription, TableRole } from './store/schema.ts';
import type { Row } from './store/rows.ts';

export interface ColumnReference {
  name: string;
  /** The SQL type, such as VARCHAR, INTEGER or ENUM('root', 'child'). */
  type: string;
  /** For an enum, its values in order. */
  values: string[];
  required: boolean;
  description: string;
  /** The table and column a foreign key on this column alone points at, such as use_case.id. */
  references: string | null;
}

export interface TableReference {
  name: string;
  role: TableRole;
  description: string;
  /** For a part table, the column naming the record each row belongs to. */
  owner_column: string | null;
  columns: ColumnReference[];
  primary_key: string[];
  unique: string[][];
  /** Foreign keys over several columns, written columns -> table (columns). */
  composite_keys: string[];
  /** CHECK constraint expressions. */
  checks: string[];
}

export interface StageReference {
  stage: Stage;
  position: number;
  label: string;
  description: string;
}

/** What designs, builds and proves an obligation kind. */
export interface ObligationReference {
  designed: string;
  built: string;
  proved: string;
}

/** A kind as the reference describes it, with the product's own kinds. */
export interface KindReference {
  kind: string;
  label: string;
  description: string;
  /** The stage its records belong to, or null outside the stages (product, open question). */
  stage: Stage | null;
  /** Its place in the order people read kinds; null for a product's own kind. */
  position: number | null;
  /** The kinds its records may sit under, with the column that names each; none for a kind with no owner. */
  parents: { kind: string; column: string }[];
  /** The kinds that may sit under this kind, by name. */
  child_kinds: string[];
  /** Whether its records are obligations: designed, built and proved. */
  obligation: boolean;
  /** For one of Lathe's obligation kinds, what designs, builds and proves it; null otherwise. */
  coverage: ObligationReference | null;
  /** For a test kind, the run by levels it allows; null otherwise. */
  levels: string[] | null;
  /** What its IDs start with, or null when they are free. */
  id_scope: IdScope | null;
  /** The ID convention, or null when none is given. */
  id: { pattern: string; example: string } | null;
  /** For a product's own kind, the product that declares it; null for Lathe's. */
  product: string | null;
  /** For a code-bound kind, how its titles are written (meta_kind_title); null for a kind titled in words. */
  title_form: KindDescription['titleForm'];
}

export interface RelationReference {
  relation: string;
  /** 'design': its links design what they target; 'proof': they prove it; '' otherwise. */
  role: 'design' | 'proof' | '';
  /** The link read from the source: "Fulfills". */
  forward_label: string;
  /** The link read from the target: "Fulfilled by". */
  reverse_label: string;
  description: string;
  /** The kinds it may link, as (source kind, target kind) pairs; a target kind of * is any record. */
  pairs: { source_kind: string; target_kind: string; description: string }[];
  /** For a product's own relation, the product that declares it; null for Lathe's. */
  product: string | null;
}

export interface CheckReference {
  /** The check's name, as problems carry it. */
  check: string;
  /** What its rows report: error, warning, or error_or_warning when each row says which. */
  severity: 'error' | 'warning' | 'error_or_warning';
  /** What it reports, in one sentence. */
  summary: string;
  /** Why it matters, ending with how to fix what it reports. */
  explanation: string;
  /** Where it comes from: Lathe's built-in checks, a product's own, or the engine itself. */
  origin: 'lathe' | 'product' | 'engine';
  /** For a product's own check, the product; null otherwise. */
  product: string | null;
  /** The kinds it concerns, the main one first; empty when it concerns records of any kind. */
  kinds: string[];
  /** The stage of its first kind; null for a check of any kind, or of a kind outside the stages. */
  stage: Stage | null;
}

/** A minimum coverage reports when a record falls short of it. */
export interface GapReference {
  gap: string;
  stage: Stage;
  /** The kinds it concerns, the record's kind first. */
  kinds: string[];
  summary: string;
}

export interface Reference {
  stages: StageReference[];
  /** Every kind, in kind order: stage by stage, then outside the stages, then the product's own by name. */
  kinds: KindReference[];
  /** Every table, in schema order: kinds first, then parts, links, declarations and checking tables. */
  tables: TableReference[];
  relations: RelationReference[];
  /** Lathe's checks in run order, then the engine's own, then the products'. */
  checks: CheckReference[];
  /** The minimums coverage reports, by stage. */
  gaps: GapReference[];
}

/** The problems the engine reports itself, outside any check row, documented as a check row would be. */
export const ENGINE_CHECKS: CheckReference[] = [
  {
    check: 'data-refused',
    severity: 'error',
    summary: 'Every data file loads: the store accepts every row of data/ with every key and rule of the schema.',
    explanation:
      'A row that breaks the schema (a missing parent, a link to a record that does not exist, a value outside its enum, an ID used twice) is refused when the data loads, and nothing is checked until it is fixed. Each refusal names the file, the line and the rule it broke. Fix the row through the CLI or the app, or resolve the merge that brought it.',
    origin: 'engine',
    product: null,
    kinds: [],
    stage: null,
  },
];

const ROLE_ORDER: TableRole[] = ['kind', 'part', 'link', 'declaration', 'checking', 'result', 'registry', 'supertype', 'meta'];

function columnReference(table: TableDescription, column: ColumnDescription): ColumnReference {
  const fk = table.foreignKeys.find((f) => f.columns.length === 1 && f.columns[0] === column.name);
  return {
    name: column.name,
    type: column.sqlType,
    values: column.values ?? [],
    required: column.required,
    description: column.description ?? '',
    references: fk ? `${fk.table}.${fk.references[0]}` : null,
  };
}

/** The reference for a schema and the check rows that run with it. */
export function referenceOf(schema: SchemaDescription, kindOrder: string[], checks: Row[]): Reference {
  const kindNames = [...kindOrder.filter((k) => schema.kinds[k]), ...Object.keys(schema.kinds).filter((k) => !kindOrder.includes(k)).sort()];
  const kinds: KindReference[] = kindNames.map((name) => {
    const k = schema.kinds[name];
    return {
      kind: k.name,
      label: k.label,
      description: k.description ?? '',
      stage: k.stage,
      position: k.position,
      parents: k.parents.map((p) => ({ kind: p.kind, column: p.column })),
      child_kinds: kindNames.filter((c) => schema.kinds[c].parents.some((p) => p.kind === name)),
      obligation: k.obligation,
      coverage: k.productId === null ? (OBLIGATION_COVERAGE[name] ?? null) : null,
      levels: k.productId === null && ALLOWED_LEVELS[name] ? [...ALLOWED_LEVELS[name]] : null,
      id_scope: k.idScope,
      id: k.idPattern ? { pattern: k.idPattern, example: k.idExample ?? '' } : null,
      product: k.productId,
      title_form: k.titleForm,
    };
  });
  const tableNames = Object.keys(schema.tables).sort((a, b) => {
    const ra = ROLE_ORDER.indexOf(schema.tables[a].role);
    const rb = ROLE_ORDER.indexOf(schema.tables[b].role);
    if (ra !== rb) return ra - rb;
    if (schema.tables[a].role === 'kind') return kindNames.indexOf(a) - kindNames.indexOf(b);
    return a.localeCompare(b);
  });
  const tables: TableReference[] = tableNames.map((name) => {
    const t = schema.tables[name];
    return {
      name,
      role: t.role,
      description: t.description ?? '',
      owner_column: t.ownerColumn,
      columns: t.columns.map((c) => columnReference(t, c)),
      primary_key: t.primaryKey,
      unique: t.unique,
      composite_keys: t.foreignKeys.filter((f) => f.columns.length > 1).map((f) => `(${f.columns.join(', ')}) -> ${f.table} (${f.references.join(', ')})`),
      checks: t.checks,
    };
  });
  const relations: RelationReference[] = Object.values(schema.relations).map((r) => ({
    relation: r.name,
    role: r.role ?? '',
    forward_label: r.forwardLabel,
    reverse_label: r.reverseLabel,
    description: r.description ?? '',
    pairs: r.pairs.map((p) => ({ source_kind: p.source, target_kind: p.target, description: p.description })),
    product: r.productId,
  }));
  const stages: StageReference[] = schema.stages.map((s) => ({ stage: s.name, position: s.position, label: s.label, description: s.description }));
  const fromRow = (row: Row): CheckReference => {
    const kinds = (row.kinds as string[] | undefined) ?? [];
    return {
      check: String(row.name),
      severity: row.severity as CheckReference['severity'],
      summary: String(row.summary),
      explanation: String(row.explanation),
      origin: row.product_id === undefined ? 'lathe' : 'product',
      product: row.product_id === undefined ? null : String(row.product_id),
      kinds,
      stage: kinds.length ? (schema.kinds[kinds[0]]?.stage ?? null) : null,
    };
  };
  const ordered = orderChecks(checks);
  return {
    stages,
    kinds,
    tables,
    relations,
    checks: [...ordered.filter((c) => c.product_id === undefined).map(fromRow), ...ENGINE_CHECKS, ...ordered.filter((c) => c.product_id !== undefined).map(fromRow)],
    gaps: GAP_RULES.map((g) => ({ gap: g.name, stage: g.stage, kinds: g.kinds, summary: g.summary })),
  };
}

/** Check rows in run order: Lathe's by position, then each product's by position. */
export function orderChecks(rows: Row[]): Row[] {
  const product = (r: Row) => (r.product_id === undefined ? '' : String(r.product_id));
  return [...rows].sort((a, b) => product(a).localeCompare(product(b)) || Number(a.position) - Number(b.position) || String(a.name).localeCompare(String(b.name)));
}

// Markdown -----------------------------------------------------------------------------------------------

export const stageAnchor = (stage: string) => `stage-${stage}`;
export const kindAnchor = (kind: string) => `kind-${kind}`;
export const tableAnchor = (table: string) => `table-${table}`;
export const relationAnchor = (relation: string) => `relation-${relation}`;
export const checkAnchor = (check: string) => `check-${check}`;
export const gapAnchor = (gap: string) => `gap-${gap}`;

const code = (text: string) => `\`${text}\``;
const cell = (text: string) => text.replaceAll('|', '\\|').replaceAll('\n', ' ');
const SEVERITY: Record<CheckReference['severity'], string> = { error: 'Error', warning: 'Warning', error_or_warning: 'Error or warning' };
const ID_SCOPE: Record<IdScope, string> = { product: "its product's ID", domain: "its domain's ID", parent: "its parent's ID" };
const TITLE_FORM: Record<NonNullable<KindDescription['titleForm']>, string> = {
  identifier: 'one identifier exactly as in code, with no whitespace',
  invocation: 'the invocation as typed, lower case first',
  'kebab-case': 'a kebab-case name',
};
const ROLE_HEADINGS: Partial<Record<TableRole, string>> = {
  declaration: "Declaration tables: a product's own kinds and relations.",
  checking: 'Checking tables: the checks and their settings.',
};

const INTRO = `# Lathe reference

Lathe keeps a product's spec as typed rows: a table per kind of record, with typed columns and real keys, so data
that breaks the model cannot be saved. Each stored table is one file, \`data/<table>.jsonl\`, with one JSON object
per line, sorted by key. Every record has exactly one parent, a foreign key such as a UC requirement's
\`use_case_id\`, except the kinds with no owner (value objects, specifications, views, integrations and UI
components), which exist because other records use them. Other relationships are links, a row of their relation's
table, and an ID is unique across every kind. Every write goes through the command layer (the CLI, the app and the
plugin's tools), which validates it in one transaction and rewrites the lines it changed; git is the history.

The model is drawn from domain-driven design, CQRS and event storming, in six stages: discovery (the business
outcomes the product exists to achieve), the domain model, use cases on top of it, their interaction design, the
technical records that implement each design record, and the test plan. Links run from what is defined first to
what is defined later. A capability names the outcomes it serves, so the trace runs from an outcome to its
capabilities, their use cases, the code and the tests. An outcome names what measures it (\`measured_by\`): a test,
or a record of a product's own kind such as a report, or it says how it is measured outside the code.

**Words.** What clean architecture calls a use case or an interactor is what Lathe calls a command handler
(\`command_handler\`): the application service that carries out one command. A Lathe use case (\`use_case\`) is the
actor's goal, one level up: its flows' steps, one flow per interface it happens through, invoke commands and queries.

**Checks** are rows of the \`check\` table. Each holds the query that finds its problems: a SELECT over the tables
returning \`severity\`, \`record\` and \`message\` for each problem. An error means the data is broken; a warning is
something to look at. Lathe's own checks are in \`lathe/data/check.jsonl\`, loaded beside every product's data; a
product adds its own as rows of its \`data/check.jsonl\` with its \`product_id\`. What the schema enforces is never a
check: the store refuses it.

**Recorded exceptions** are deliberate deviations recorded with their reason: a command that also changes another
aggregate of its domain in the same transaction (a \`command_change\` row), or a repository that also persists an
aggregate with no repository of its own (a \`repository_share\` row), such as one generic store. They are not
problems: \`lathe check\` and the Checks panel list every one in a section of their own, with its command or
repository, aggregate and reason, so each stays visible.

**Coverage** counts every obligation as designed, built and proved, per domain and for the product outside every
domain, and lists as gaps each obligation still short of one, and each record short of a minimum the schema leaves to
it (an "at least one" or "exactly one" that is missing while records are written stage by stage). An obligation is
proved by a test of it, automated or manual, at a run by level its test kind allows, whose file (when automated)
exists and names the test's ID.`;

/** The reference as one Markdown document, by stage: each stage's kinds with their tables, checks and gaps; then the other tables, relations and checks of any kind, each with an anchor. */
export function renderReference(ref: Reference): string {
  const kindLink = (kind: string) =>
    kind === '*' ? 'any record' : ref.kinds.some((k) => k.kind === kind) ? `[${code(kind)}](#${kindAnchor(kind)})` : code(kind);
  const shown = new Set<TableRole>(['kind', 'part', 'declaration', 'checking']);
  const tableLink = (table: string) => (ref.tables.some((t) => t.name === table && shown.has(t.role)) ? `[${code(table)}](#${tableAnchor(table)})` : code(table));
  const checkLink = (check: string) => `[${code(check)}](#${checkAnchor(check)})`;
  const list = (items: string[], none = 'none') => (items.length ? items.join(', ') : none);
  const out: string[] = [INTRO, '', '<!-- Generated from the schema, the check rows and the coverage rules by `npm --prefix lathe run reference`. Do not edit it by hand. -->', ''];

  const columns = (t: TableReference) => {
    out.push('| Column | Type | Required | Meaning |', '| --- | --- | --- | --- |');
    for (const c of t.columns) {
      const type = c.references ? `${c.type} → ${tableLink(c.references.split('.')[0])}` : c.type;
      out.push(`| ${code(c.name)} | ${cell(type)} | ${c.required ? 'yes' : 'no'} | ${cell(c.description || '-')} |`);
    }
    out.push('');
    out.push(
      `- **Key:** ${t.primary_key.map(code).join(', ') || 'none'}`,
      ...t.unique.map((u) => `- **Unique:** ${u.map(code).join(', ')}`),
      ...t.composite_keys.map((k) => `- **Foreign key:** ${code(k)}`),
      ...t.checks.map((c) => `- **Rule:** ${code(c)}`),
      '',
    );
  };

  const table = (t: TableReference, heading: string) => {
    out.push(`<a id="${tableAnchor(t.name)}"></a>`, '', `${heading} ${code(t.name)}`, '', t.description || '_No description._', '');
    columns(t);
  };

  const kind = (k: KindReference) => {
    out.push(`<a id="${kindAnchor(k.kind)}"></a>`, '', `### ${k.label} (${code(k.kind)})`, '', k.description.trim() || '_No description._', '');
    out.push(`- **Parents:** ${list(k.parents.map((p) => `${kindLink(p.kind)} (${code(p.column)})`), k.kind === 'product' ? 'none (a root record)' : 'none (no owner: it exists because other records use it)')}`);
    out.push(`- **Children:** ${list(k.child_kinds.map(kindLink))}`);
    out.push(`- **Obligation:** ${k.obligation ? 'yes: designed, built and proved' : 'no'}`);
    if (k.coverage) out.push(`  - **Designed:** ${k.coverage.designed}`, `  - **Built:** ${k.coverage.built}`, `  - **Proved:** ${k.coverage.proved}`);
    if (k.levels) out.push(`- **Run by levels:** ${k.levels.map(code).join(', ')}`);
    if (k.id) out.push(`- **ID:** ${code(k.id.pattern)}, such as ${code(k.id.example)}${k.id_scope ? `; it starts with ${ID_SCOPE[k.id_scope]}` : ''}`);
    if (k.title_form) out.push(`- **Title:** ${TITLE_FORM[k.title_form]} (refused otherwise)`);
    if (k.product) out.push(`- **Declared by:** product ${code(k.product)}`);
    const byLabel = (rels: RelationReference[], label: (r: RelationReference) => string) => [...new Set(rels.map((r) => `${cell(label(r))} ([${code(r.relation)}](#${relationAnchor(r.relation)}))`))];
    const outgoing = byLabel(ref.relations.filter((r) => r.pairs.some((p) => p.source_kind === k.kind)), (r) => r.forward_label);
    const incoming = byLabel(ref.relations.filter((r) => r.pairs.some((p) => p.target_kind === k.kind || p.target_kind === '*')), (r) => r.reverse_label);
    out.push(`- **Links out:** ${list(outgoing)}`);
    out.push(`- **Links in:** ${list(incoming)}`);
    const parts = ref.tables.filter((t) => t.role === 'part' && t.owner_column && t.columns.find((c) => c.name === t.owner_column)?.references === `${k.kind}.id`);
    if (parts.length) out.push(`- **Parts:** ${parts.map((t) => tableLink(t.name)).join(', ')}`);
    const checks = ref.checks.filter((c) => c.kinds.includes(k.kind));
    if (checks.length) out.push(`- **Checks:** ${checks.map((c) => checkLink(c.check)).join(', ')}`);
    const gaps = ref.gaps.filter((g) => g.kinds[0] === k.kind);
    if (gaps.length) out.push(`- **Gaps:** ${gaps.map((g) => `[${code(g.gap)}](#${gapAnchor(g.gap)})`).join(', ')}`);
    out.push('');
    const own = ref.tables.find((t) => t.name === k.kind);
    if (own) {
      out.push(`<a id="${tableAnchor(own.name)}"></a>`, '');
      columns(own);
    }
    for (const p of parts) table(p, '####');
  };

  const check = (c: CheckReference) => {
    const where = c.origin === 'lathe' ? "Lathe's" : c.origin === 'engine' ? 'the engine' : `product ${code(c.product ?? '')}`;
    out.push(`<a id="${checkAnchor(c.check)}"></a>`, '', `### ${code(c.check)}`, '');
    out.push(`**${SEVERITY[c.severity]}** · ${where}${c.kinds.length ? ` · Kinds: ${c.kinds.map(kindLink).join(', ')}` : ''}`, '');
    out.push(c.summary || '_No summary._', '');
    if (c.explanation) out.push(c.explanation, '');
  };

  const section = (title: string, intro: string, kinds: KindReference[], checks: CheckReference[], gaps: GapReference[], anchor: string | null) => {
    if (anchor) out.push(`<a id="${anchor}"></a>`, '');
    out.push(`## ${title}`, '', intro, '');
    for (const k of kinds) kind(k);
    if (checks.length) {
      out.push(`### Checks: ${title.toLowerCase()}`, '');
      for (const c of checks) check(c);
    }
    if (gaps.length) {
      out.push(`### Coverage gaps: ${title.toLowerCase()}`, '', 'Each is reported in coverage, under the record that falls short, never as a problem.', '');
      out.push('| Gap | Kinds | What it reports |', '| --- | --- | --- |');
      for (const g of gaps) out.push(`| <a id="${gapAnchor(g.gap)}"></a>${code(g.gap)} | ${g.kinds.map(kindLink).join(', ')} | ${cell(g.summary)} |`);
      out.push('');
    }
  };

  for (const s of ref.stages) {
    section(s.label, s.description.trim(), ref.kinds.filter((k) => k.stage === s.stage), ref.checks.filter((c) => c.stage === s.stage), ref.gaps.filter((g) => g.stage === s.stage), stageAnchor(s.stage));
  }
  section(
    'Outside the stages',
    'The product, the roles its records name and its open questions, which belong to no stage.',
    ref.kinds.filter((k) => k.stage === null),
    ref.checks.filter((c) => c.stage === null && c.kinds.length > 0),
    [],
    null,
  );

  out.push('## Other tables', '', 'The tables that are not a kind of record or one of its parts, and are kept in data files.', '');
  for (const role of ['declaration', 'checking'] as const) {
    out.push(`### ${ROLE_HEADINGS[role]}`, '');
    for (const t of ref.tables.filter((x) => x.role === role)) table(t, '####');
  }
  const placed = new Set(ref.kinds.flatMap((k) => ref.tables.filter((t) => t.role === 'part' && t.columns.find((c) => c.name === t.owner_column)?.references === `${k.kind}.id`).map((t) => t.name)));
  const loose = ref.tables.filter((t) => t.role === 'part' && !placed.has(t.name));
  if (loose.length) {
    out.push('### Other part tables: rows that belong to one record and are removed with it.', '');
    for (const t of loose) table(t, '####');
  }

  out.push(
    '## Relations',
    '',
    'Every relation: a link is a row (`source_id`, `target_id`) of the table named after it. Which kinds it may link, what the link does, and the words it reads as from the source (forward) and from the target (reverse).',
    '',
  );
  for (const r of ref.relations) {
    out.push(`<a id="${relationAnchor(r.relation)}"></a>`, '', `### ${code(r.relation)}`, '', r.description || '_No description._', '');
    out.push(`- **Reads:** ${r.forward_label} / ${r.reverse_label}`);
    out.push(`- **Role:** ${r.role || 'none'}`);
    if (r.product) out.push(`- **Declared by:** product ${code(r.product)}`);
    out.push('', '| From | To | Meaning |', '| --- | --- | --- |');
    for (const p of r.pairs) out.push(`| ${kindLink(p.source_kind)} | ${kindLink(p.target_kind)} | ${cell(p.description || '-')} |`);
    out.push('');
  }

  out.push('## Checks of any kind', '', "The checks that concern records of any kind: Lathe's, in the order they run, then the engine's own, then the product's.", '');
  for (const c of ref.checks.filter((x) => x.kinds.length === 0)) check(c);
  return `${out.join('\n').trimEnd()}\n`;
}
