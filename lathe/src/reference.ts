// The format reference: every kind, relation, folder and check, read from the meta-model and the check files'
// header comments, so the reference is generated rather than kept by hand. formatReference(root) in index.ts
// builds it for a product (with its extensions and its own checks); renderReference writes it as Markdown, as
// `lathe format` prints it and lathe/REFERENCE.md holds it.

/** A kind as the reference describes it, after the product's extensions. */
export interface KindReference {
  kind: string;
  label: string;
  description: string;
  /** 'define', 'design', or '' for structural kinds. */
  stage: string;
  /** The folder the kind sits in (a section of sections.csv), or ''. */
  section: string;
  parent_kinds: string[];
  /** The kinds that list this kind among their parent_kinds, in meta-model order. */
  child_kinds: string[];
  required_fields: string[];
  /** 'yes': designed, built and proved; 'proof': proved only; 'no': not an obligation. */
  obligation: 'yes' | 'proof' | 'no';
  /** The ID convention, from meta/ids.csv, or null when none is given. */
  id: { pattern: string; example: string } | null;
}

export interface RelationReference {
  relation: string;
  source_kind: string;
  /** A kind, or '*' for any kind. */
  target_kind: string;
  role: 'design' | 'proof' | '';
  description: string;
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
  /** The check's name, as problems carry it: its file name without the number and .sql. */
  check: string;
  /** The highest severity it reports. */
  severity: Severity;
  /** Every severity it can report, from its `severity:` header line. */
  severities: Severity[];
  /** The header's first paragraph: what the check asks, in one sentence. */
  summary: string;
  /** The rest of the header, as Markdown: what it reports, what it leaves to other checks, and how to fix it. */
  explanation: string;
  /** Where it comes from: Lathe's checks folder, the product's own checks, or the engine itself. */
  origin: 'lathe' | 'product' | 'engine';
  /** The file: checks/<file> for Lathe's, a path from the product root for the product's, or the engine's source file. */
  source: string;
  /** The kinds it concerns, from its optional `kinds:` header line; empty when it concerns records of any kind. */
  kinds: string[];
}

export interface FormatReference {
  /** The concepts: Lathe's FORMAT.md, as Markdown. */
  concepts: string;
  kinds: KindReference[];
  relations: RelationReference[];
  /** The folders, in stage then order. */
  sections: SectionReference[];
  /** Lathe's checks in file order, then the engine's own, then the product's. */
  checks: CheckReference[];
}

/** What a check file's header comment says, and what is missing from it. */
export interface CheckHeader {
  summary: string;
  explanation: string;
  severities: Severity[];
  kinds: string[];
  /** What the header lacks, in words for the undocumented check: empty when it is complete. */
  missing: string[];
}

const FIELD_LINE = /^(severity|kinds):\s*(.*)$/;

// Reads the comment lines a check file starts with. The shape is: one summary sentence, a blank comment line,
// the explanation (one or more paragraphs of Markdown, ending with how to fix it), a blank comment line, then
// a `severity:` line (error, warning, or both separated by a comma) and an optional `kinds:` line listing the
// kinds it concerns, separated by spaces.
export function parseCheckHeader(sql: string): CheckHeader {
  const lines: string[] = [];
  for (const line of sql.split(/\r?\n/)) {
    if (!line.startsWith('--')) break;
    lines.push(line.replace(/^--\s?/, '').trimEnd());
  }
  let severities: Severity[] = [];
  let kinds: string[] = [];
  let badSeverity = false;
  let sawSeverity = false;
  const prose: string[] = [];
  for (const line of lines) {
    const field = line.match(FIELD_LINE);
    if (!field) {
      prose.push(line);
      continue;
    }
    const words = field[2].split(/[\s,]+/).filter(Boolean);
    if (field[1] === 'kinds') {
      kinds = words;
      continue;
    }
    sawSeverity = true;
    const valid = words.length > 0 && words.every((w) => w === 'error' || w === 'warning');
    if (!valid) badSeverity = true;
    else severities = (['error', 'warning'] as const).filter((s) => words.includes(s));
  }
  const paragraphs = prose
    .join('\n')
    .split(/\n\s*\n/)
    .map((p) => p.replace(/^\n+|\n+$/g, ''))
    .filter((p) => p.trim() !== '');
  const summary = (paragraphs[0] ?? '').split('\n').map((l) => l.trim()).join(' ');
  const explanation = paragraphs.slice(1).join('\n\n');
  const missing: string[] = [];
  if (summary === '') missing.push('summary sentence');
  if (explanation === '') missing.push('explanation');
  if (!sawSeverity) missing.push('severity line');
  else if (badSeverity) missing.push('valid severity line (error or warning)');
  return { summary, explanation, severities, kinds, missing };
}

/** The problems the engine reports itself, outside any check file, documented here as a check file would be. */
export const ENGINE_CHECKS: CheckReference[] = [
  {
    check: 'parse-error',
    severity: 'error',
    severities: ['error'],
    summary: 'Every record file can be read: a YAML header between `---` lines, then a Markdown body.',
    explanation:
      'A file under the specs folder whose header is missing, is not valid YAML, or is not a map of fields is reported with the reason, and loading carries on without it. Fix the header, or rename the file to README.md if it is not a record.',
    origin: 'engine',
    source: 'src/parse.ts',
    kinds: [],
  },
  {
    check: 'parent-cycle',
    severity: 'error',
    severities: ['error'],
    summary: "A record's parent chain never loops back to the record itself.",
    explanation:
      'Each record on the loop is reported, with the chain. A record on a loop sits in no product or domain. Fix the `parent` of one record on the loop.',
    origin: 'engine',
    source: 'src/index.ts',
    kinds: [],
  },
  {
    check: 'product-check-name-clash',
    severity: 'error',
    severities: ['error'],
    summary: "A product check is not named like one of Lathe's checks.",
    explanation:
      "A product check whose name (its file name without the number and .sql) equals one of Lathe's checks, or a problem the engine reports itself, is not run, so the two never mix in a report. Rename the file.",
    origin: 'engine',
    source: 'src/index.ts',
    kinds: [],
  },
  {
    check: 'product-checks-missing',
    severity: 'error',
    severities: ['error'],
    summary: 'The checks folder that lathe.config.json names exists.',
    explanation: 'When it does not, none of the product\'s checks run. Fix the `checks` path in lathe.config.json, or create the folder.',
    origin: 'engine',
    source: 'src/index.ts',
    kinds: [],
  },
];

// Markdown -----------------------------------------------------------------------------------------------

export const kindAnchor = (kind: string) => `kind-${kind}`;
export const relationAnchor = (relation: string) => `relation-${relation}`;
export const sectionAnchor = (section: string) => `folder-${section}`;
export const checkAnchor = (check: string) => `check-${check}`;

const STAGES: Record<string, string> = { define: 'Define', design: 'Design', '': 'Product level' };
const stageLabel = (stage: string) => STAGES[stage] ?? stage;
const code = (text: string) => `\`${text}\``;
const cell = (text: string) => text.replaceAll('|', '\\|').replaceAll('\n', ' ');

/** The reference as one Markdown document: the concepts, then kinds, relations, folders and checks, each with an anchor. */
export function renderReference(ref: FormatReference): string {
  const kindLink = (kind: string) =>
    kind === '*' ? 'any kind' : ref.kinds.some((k) => k.kind === kind) ? `[${code(kind)}](#${kindAnchor(kind)})` : code(kind);
  const sectionLink = (section: string) => {
    const s = ref.sections.find((x) => x.section === section);
    return s ? `[${s.label}](#${sectionAnchor(section)})` : code(section);
  };
  const list = (items: string[], none = 'none') => (items.length ? items.join(', ') : none);
  const out: string[] = [ref.concepts.trimEnd(), ''];

  out.push(
    '<!-- Everything below is generated from the meta-model and the check files by `lathe format`. Do not edit it here. -->',
    '',
    '## Kinds',
    '',
    'Every kind of record, after the product\'s extensions, from `meta/kinds.csv` and `meta/ids.csv`.',
    '',
  );
  for (const k of ref.kinds) {
    out.push(`<a id="${kindAnchor(k.kind)}"></a>`, '', `### ${k.label} (${code(k.kind)})`, '', k.description.trim() || '_No description._', '');
    out.push(`- **Stage:** ${k.stage ? stageLabel(k.stage) : 'none (structural)'}`);
    out.push(`- **Folder:** ${k.section ? sectionLink(k.section) : 'none'}`);
    out.push(`- **Parents:** ${list(k.parent_kinds.map(kindLink), k.kind === 'product' ? 'none (a root record)' : 'none')}`);
    out.push(`- **Children:** ${list(k.child_kinds.map(kindLink))}`);
    out.push(`- **Required fields:** ${list(k.required_fields.map(code))}`);
    out.push(`- **Obligation:** ${k.obligation === 'yes' ? 'yes: designed, built and proved' : k.obligation === 'proof' ? 'proof only' : 'no'}`);
    if (k.id) out.push(`- **ID:** ${code(k.id.pattern)}, such as ${code(k.id.example)}`);
    const outgoing = [...new Set(ref.relations.filter((r) => r.source_kind === k.kind).map((r) => r.relation))];
    const incoming = [...new Set(ref.relations.filter((r) => r.target_kind === k.kind || r.target_kind === '*').map((r) => r.relation))];
    out.push(`- **Links out:** ${list(outgoing.map((r) => `[${code(r)}](#${relationAnchor(r)})`))}`);
    out.push(`- **Links in:** ${list(incoming.map((r) => `[${code(r)}](#${relationAnchor(r)})`))}`);
    const checks = ref.checks.filter((c) => c.kinds.includes(k.kind));
    if (checks.length) out.push(`- **Checks:** ${checks.map((c) => `[${code(c.check)}](#${checkAnchor(c.check)})`).join(', ')}`);
    out.push('');
  }

  out.push('## Relations', '', 'Every relation, from `meta/relations.csv`: which kind may link to which, and what the link does.', '');
  const names = [...new Set(ref.relations.map((r) => r.relation))];
  for (const name of names) {
    const rows = ref.relations.filter((r) => r.relation === name);
    out.push(`<a id="${relationAnchor(name)}"></a>`, '', `### ${code(name)}`, '');
    out.push('| From | To | Role | Meaning |', '| --- | --- | --- | --- |');
    for (const r of rows) out.push(`| ${kindLink(r.source_kind)} | ${kindLink(r.target_kind)} | ${r.role || '-'} | ${cell(r.description.trim() || '-')} |`);
    out.push('');
  }

  out.push('## Folders', '', 'The folders kinds sit in, from `meta/sections.csv`, in stage then order.', '');
  for (const s of ref.sections) {
    const kinds = ref.kinds.filter((k) => k.section === s.section).map((k) => kindLink(k.kind));
    out.push(`<a id="${sectionAnchor(s.section)}"></a>`, '', `### ${s.label} (${code(s.section)})`, '', s.description.trim(), '');
    out.push(`- **Stage:** ${stageLabel(s.stage)}, order ${s.order}`, `- **Kinds:** ${list(kinds)}`, '');
  }

  out.push('## Checks', '', "Every check, from the header comment of its file: Lathe's checks, the engine's own, then the product's.", '');
  for (const c of ref.checks) {
    const severity = c.severities.map((s) => (s === 'error' ? 'Error' : 'Warning')).join(' or ') || 'Error';
    const where = c.origin === 'lathe' ? `Lathe's ${code(c.source)}` : c.origin === 'engine' ? `the engine, ${code(c.source)}` : `the product's ${code(c.source)}`;
    out.push(`<a id="${checkAnchor(c.check)}"></a>`, '', `### ${code(c.check)}`, '');
    out.push(`**${severity}** · ${where}${c.kinds.length ? ` · Kinds: ${c.kinds.map(kindLink).join(', ')}` : ''}`, '');
    out.push(c.summary || '_No summary._', '');
    if (c.explanation) out.push(c.explanation, '');
  }
  return `${out.join('\n').trimEnd()}\n`;
}
