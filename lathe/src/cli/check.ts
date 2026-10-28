// lathe check: loads each product of the repo, checks it and prints its errors, warnings, recorded exceptions and
// coverage, or the workspaces as JSON. The command line runs it; tests run it in process with their own output.
import path from 'node:path';
import { exceptionsText, loadProducts, type Problem, type Workspace } from '../index.ts';
import { SchemaVersionError } from '../config.ts';

/** Where a command's output and errors go, one line or block per call. */
export interface CommandIo {
  out: (text: string) => void;
  err: (text: string) => void;
}

/** A label inside a sentence: "Use case" -> "use case", but an acronym keeps its case ("UC requirement"). */
const lowerLabel = (label: string) => (/^[A-Z]{2}/.test(label) ? label : label.charAt(0).toLowerCase() + label.slice(1));

/** "1 error", "2 warnings". */
const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;

/** Runs lathe check on the repo at root; returns the exit code: 0 no errors, 1 errors, 2 data for another schema. */
export async function runCheck(root: string, options: { json?: boolean }, io: CommandIo): Promise<number> {
  let products;
  try {
    products = await loadProducts(root);
  } catch (error) {
    // A product whose data is for another schema: one clear message, never a stack trace.
    if (!(error instanceof SchemaVersionError)) throw error;
    io.err(error.message);
    return 2;
  }
  const sum = (severity: Problem['severity']) => products.reduce((n, { workspace }) => n + workspace.problems.filter((p) => p.severity === severity).length, 0);
  const errors = sum('error');
  if (options.json) {
    const folder = (dir: string) => path.relative(root, dir).split(path.sep).join('/') || '.';
    io.out(JSON.stringify({ products: products.map(({ config, workspace }) => ({ root: folder(config.root), workspace })) }, null, 2));
  } else {
    // Each product is reported on its own; a workspace with several ends with the sum.
    products.forEach(({ config, workspace }, at) => {
      if (at > 0) io.out('');
      printProduct(io, config.root, workspace);
    });
    if (products.length > 1) io.out(`\nAll ${products.length} products: ${count(errors, 'error')}, ${count(sum('warning'), 'warning')}.`);
  }
  return errors ? 1 : 0;
}

/** One product's check: its errors, warnings, recorded exceptions and coverage, then its counts. */
function printProduct(io: CommandIo, productRoot: string, workspace: Workspace) {
  const errors = workspace.problems.filter((p) => p.severity === 'error');
  const warnings = workspace.problems.filter((p) => p.severity === 'warning');
  const line = (p: Problem) => `  [${p.check}]${p.record ? ` ${p.record}:` : ''} ${p.message}`;
  io.out(`Checked ${workspace.records.length} records in ${productRoot}`);
  if (errors.length) io.out(`\nErrors (${errors.length}):\n${errors.map(line).join('\n')}`);
  if (warnings.length) io.out(`\nWarnings (${warnings.length}):\n${warnings.map(line).join('\n')}`);
  if (workspace.exceptions.length) io.out(`\n${exceptionsText(workspace.exceptions)}`);
  if (workspace.coverage.length) {
    io.out('\nCoverage:');
    for (const c of workspace.coverage) {
      const scope = c.domain ?? `${c.product} Shared`;
      const counted = c.obligations.filter((o) => o.total > 0);
      const kinds = new Set(counted.map((o) => o.kind));
      const minimums = c.gaps.filter((g) => !['designed', 'built', 'proved'].includes(g.missing));
      const tested = c.tests.automated + c.tests.manual + c.tests.not_automated;
      if (!counted.length && !minimums.length && !tested) continue;
      for (const o of counted) {
        const of = (n: number) => `${n}/${o.total}`;
        // A proof-only kind (a pattern rule) is not asked to be designed or built.
        const design = o.proof_only ? 'proof only' : `${of(o.designed)} designed, ${of(o.built)} built`;
        const waiting = o.not_automated ? `, ${of(o.not_automated)} not automated yet` : '';
        io.out(`  ${scope} ${lowerLabel(o.label)}: ${design}, ${of(o.proved)} proved${waiting}`);
        for (const g of c.gaps.filter((x) => x.kind === o.kind && kinds.has(x.kind) && ['designed', 'built', 'proved'].includes(x.missing))) io.out(`    gap: ${g.message}`);
      }
      if (tested) io.out(`  ${scope} tests: ${c.tests.automated} automated, ${c.tests.manual} manual, ${c.tests.not_automated} not automated yet`);
      if (minimums.length) {
        io.out(`  ${scope} records short of a minimum (${minimums.length}):`);
        for (const g of minimums) io.out(`    [${g.missing}] ${g.message}`);
      }
    }
  }
  io.out(`\n${count(errors.length, 'error')}, ${count(warnings.length, 'warning')}.`);
}
