// What the CLI and the plugin's MCP server share: opening the store for one aggregate command or query, a refusal's
// reasons in words, and the check. Each opens the store afresh, so it always works on the data files as they are now
// (the Owner, the app or git may have changed them since the last call). Writes never commit: the Agent or the Owner
// commits.
import path from 'node:path';
import { loadProducts, type Coverage, type Problem } from '../index.ts';
import { STRICT_CHECK, strictSummary, type ProductStrictness } from '../checking/product-setting/strictness.ts';
import type { SchemaDescription } from '../platform/data/schema.ts';
import { SchemaVersionError } from '../config.ts';
import { StoreError, type StoreProblem } from '../platform/data/problems.ts';
import { openStore, type Store } from '../platform/data/store.ts';

/** What an operation gives back: its result, or the refusal with every reason. A refusal changed nothing. */
export type Outcome<T> = { ok: true; value: T } | { ok: false; problems: StoreProblem[] };

/** Opens the store at root, runs the operation, and closes it; a refusal or a store that does not load is an Outcome. */
export async function withStore<T>(root: string, run: (store: Store) => Promise<T>): Promise<Outcome<T>> {
  let store: Store;
  try {
    store = await openStore(root);
  } catch (error) {
    if (error instanceof StoreError) return { ok: false, problems: [{ rule: 'load', message: 'the data files do not load; fix them first' }, ...error.problems] };
    throw error;
  }
  try {
    return { ok: true, value: await run(store) };
  } catch (error) {
    if (error instanceof StoreError) return { ok: false, problems: error.problems.map((p) => ({ ...p, message: reasonText(p) })) };
    throw error;
  } finally {
    await store.close();
  }
}

/** The schema, with the product's own kinds: from its data, or Lathe's alone when the data does not load. */
export async function readSchema(root: string): Promise<SchemaDescription> {
  let store: Store;
  try {
    store = await openStore(root);
  } catch (error) {
    // Data for another schema version is not read at all.
    if (error instanceof SchemaVersionError) throw error;
    // A data folder that does not exist loads as empty data, with Lathe's schema.
    store = await openStore(root, { dataDir: path.join(root, '.lathe-schema-only') });
  }
  const schema = store.schema;
  await store.close();
  return schema;
}

/** One problem the check found. */
export interface CheckProblem {
  severity: 'error' | 'warning';
  check: string;
  record: string | null;
  message: string;
}

/** One product's coverage, as `lathe check --json` gives it: the product's folder from the workspace root, the strictness of each product it holds, and its coverage with its gaps. */
export interface CheckedProduct {
  root: string;
  strictness: ProductStrictness[];
  coverage: Coverage[];
}

/** A product's folder from the workspace root, with forward slashes: `.` for the root itself. */
export const productFolder = (root: string, dir: string) => path.relative(root, dir).split(path.sep).join('/') || '.';

/** Runs the check on the workspace, every product it shows: their errors and warnings, and each product's coverage. */
export async function check(root: string): Promise<{ errors: number; warnings: number; problems: CheckProblem[]; products: CheckedProduct[] }> {
  const products = await loadProducts(root);
  const problems = products.flatMap(({ workspace }) => workspace.problems).map((p) => ({ severity: p.severity, check: p.check, record: p.record ?? null, message: p.message }));
  return {
    errors: problems.filter((p) => p.severity === 'error').length,
    warnings: problems.filter((p) => p.severity === 'warning').length,
    problems,
    products: products.map(({ config, workspace, strictness }) => ({ root: productFolder(root, config.root), strictness, coverage: workspace.coverage })),
  };
}

/**
 * The problems a write introduced: each warning, and each strict-check error, in the run after it that the run before
 * it did not hold, so an Agent fixes them at once. A problem is the one before when it has the same check and record
 * (a problem about no record, the same message too): a warning whose words change with the data, such as a count,
 * is not a new one.
 */
export function introducedProblems(before: readonly Problem[], after: readonly Problem[]): CheckProblem[] {
  const key = (p: Problem) => `${p.check}\u0000${p.record ?? `\u0000${p.message}`}`;
  const left = new Map<string, number>();
  for (const p of before) left.set(key(p), (left.get(key(p)) ?? 0) + 1);
  return after
    .filter((p) => p.severity === 'warning' || p.check === STRICT_CHECK)
    .filter((p) => {
      const n = left.get(key(p)) ?? 0;
      if (n > 0) left.set(key(p), n - 1);
      return n === 0;
    })
    .map((p) => ({ severity: p.severity, check: p.check, record: p.record ?? null, message: p.message }));
}

// Text, as the CLI prints it and the MCP tools return it.

/** The problems a write introduced, or that it introduced none. */
export function introducedText(introduced: readonly CheckProblem[]): string {
  if (!introduced.length) return 'No new warnings.';
  return `This write introduced ${count(introduced.length, 'problem')}; fix ${introduced.length === 1 ? 'it' : 'them'} now:\n${introduced.map((p) => `  [${p.check}]${p.record ? ` ${p.record}:` : ''} ${p.message}`).join('\n')}`;
}

const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;

// The table rules (CHECK constraints) the schema has, from DuckDB's printing of them to words: the rule with its
// parentheses, casts and quotes taken out, then matched against the shapes the schema uses. Any other rule reads as
// its expression.
const RULE_SHAPES: [RegExp, (...m: string[]) => string][] = [
  [/^(\w+) IS NULL <> (\w+) IS NULL$/, (a, b) => `exactly one of ${a} and ${b} is given`],
  [/^(\w+) IS NOT NULL \+ (\w+) IS NOT NULL \+ (\w+) IS NOT NULL = 1$/, (a, b, c) => `exactly one of ${a}, ${b} and ${c} is given`],
  [/^(\w+) IS NULL OR (\w+) = '([^']*)'$/, (a, b, v) => `${a} is given only when ${b} is ${v}`],
  [/^(\w+) IS NULL OR (\w+)$/, (a, b) => `${a} is given only when ${b} is true`],
  [/^(\w+) <> '([^']*)' OR (\w+) IS NOT NULL$/, (a, v, b) => `${b} is given when ${a} is ${v}`],
  [/^(\w+) = '([^']*)' = (\w+) IS NOT NULL$/, (a, v, b) => `${b} is given when, and only when, ${a} is ${v}`],
  [/^(\w+) IS NULL OR (\w+) <> (\w+)$/, (a, _, b) => `${a} is not the ${b}`],
  [/^(\w+) <> (\w+)$/, (a, b) => `${a} and ${b} differ`],
  [/^len (\w+) >= 1$/, (a) => `${a} has at least one item`],
  [/^(\w+) >= (\d+)$/, (a, n) => `${a} is ${n} or more`],
  [/^(\w+)$/, (a) => `${a} is true when given`],
];

function ruleInWords(expression: string): string {
  const plain = expression
    .replace(/CAST\(\((.*?)\) AS INTEGER\)/g, '$1')
    .replace(/"/g, '')
    .replace(/!=/g, '<>')
    .replace(/[()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  for (const [shape, words] of RULE_SHAPES) {
    const m = shape.exec(plain);
    if (m) return words(...m.slice(1));
  }
  return plain;
}

/** A refusal's reason, with a broken table rule said in words. */
function reasonText(p: StoreProblem): string {
  if (p.rule !== 'check') return p.message;
  return p.message.replace(/CHECK constraint failed on table "[^"]+" with expression CHECK\((.*)\)$/s, (_, expression: string) => ruleInWords(expression));
}

/** A refusal: nothing changed, then each reason. */
export function refusalText(problems: StoreProblem[]): string {
  const where = (p: StoreProblem) => (p.file ? `${p.file}:${p.line}: ` : '');
  return `Refused; nothing changed:\n${problems.map((p) => `  ${where(p)}${p.message} [${p.rule}]`).join('\n')}`;
}

/** A label inside a sentence: "Use case" -> "use case", but an acronym keeps its case ("UC requirement"). */
const lowerLabel = (label: string) => (/^[A-Z]{2}/.test(label) ? label : label.charAt(0).toLowerCase() + label.slice(1));

/**
 * A product's coverage, one line per domain and obligation kind with how many are designed, built and proved, each
 * gap under its kind, the tests per state, the records short of a minimum, and the accidental debt (each fill); nothing
 * for a scope with none of these.
 */
export function coverageLines(coverage: Coverage[]): string[] {
  const lines: string[] = [];
  for (const c of coverage) {
    const scope = c.domain ?? `${c.product} Shared`;
    const counted = c.obligations.filter((o) => o.total > 0);
    const kinds = new Set(counted.map((o) => o.kind));
    const minimums = c.gaps.filter((g) => !['designed', 'built', 'proved'].includes(g.missing));
    const tested = c.tests.automated + c.tests.manual + c.tests.not_automated;
    if (!counted.length && !minimums.length && !tested && !c.debt.length) continue;
    for (const o of counted) {
      const of = (n: number) => `${n}/${o.total}`;
      // A proof-only kind (a pattern rule) is not asked to be designed or built.
      const design = o.proof_only ? 'proof only' : `${of(o.designed)} designed, ${of(o.built)} built`;
      const waiting = o.not_automated ? `, ${of(o.not_automated)} not automated yet` : '';
      lines.push(`  ${scope} ${lowerLabel(o.label)}: ${design}, ${of(o.proved)} proved${waiting}`);
      for (const g of c.gaps.filter((x) => x.kind === o.kind && kinds.has(x.kind) && ['designed', 'built', 'proved'].includes(x.missing))) lines.push(`    gap: ${g.message}`);
    }
    if (tested) lines.push(`  ${scope} tests: ${c.tests.automated} automated, ${c.tests.manual} manual, ${c.tests.not_automated} not automated yet`);
    if (minimums.length) {
      lines.push(`  ${scope} records short of a minimum (${minimums.length}):`);
      for (const g of minimums) lines.push(`    [${g.missing}] ${g.message}`);
    }
    if (c.debt.length) {
      lines.push(`  ${scope} accidental debt (${c.debt.length} ${c.debt.length === 1 ? 'fill' : 'fills'}):`);
      for (const d of c.debt) lines.push(`    ${d.id} fills ${d.slot}`);
    }
  }
  return lines;
}

/** The check's problems, errors first, each product's coverage with its gaps, and a count line. */
export function checkText(result: Awaited<ReturnType<typeof check>>): string {
  const line = (p: CheckProblem) => `  [${p.check}]${p.record ? ` ${p.record}:` : ''} ${p.message}`;
  const errors = result.problems.filter((p) => p.severity === 'error');
  const warnings = result.problems.filter((p) => p.severity === 'warning');
  const parts: string[] = [];
  if (errors.length) parts.push(`Errors (${errors.length}):\n${errors.map(line).join('\n')}`);
  if (warnings.length) parts.push(`Warnings (${warnings.length}):\n${warnings.map(line).join('\n')}`);
  // A workspace of several products names each one's folder over its coverage.
  for (const product of result.products) {
    const lines = coverageLines(product.coverage);
    if (lines.length) parts.push(`Coverage${result.products.length > 1 ? ` of ${product.root}` : ''}:\n${lines.join('\n')}`);
  }
  parts.push([`${count(result.errors, 'error')}, ${count(result.warnings, 'warning')}.`, ...result.products.flatMap((p) => p.strictness.map(strictSummary)).filter(Boolean)].join(' '));
  return parts.join('\n\n');
}
