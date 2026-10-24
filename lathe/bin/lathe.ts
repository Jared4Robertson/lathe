#!/usr/bin/env node
// lathe check [root] [--json]
// Loads and checks the spec workspace. Prints errors, warnings and coverage, or the whole
// workspace as JSON with --json. Exits 1 if there is any error.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadWorkspace, type Problem } from '../src/index.ts';

const args = process.argv.slice(2);
const json = args.includes('--json');
const positional = args.filter((a) => !a.startsWith('--'));
if (args.includes('--help') || positional.length > 1) {
  console.log('Usage: npm --prefix lathe run check [-- [root] [--json]]\nroot defaults to the repo that holds lathe/.');
  process.exit(positional.length > 1 ? 2 : 0);
}
const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const root = path.resolve(positional[0] ?? defaultRoot);

const workspace = await loadWorkspace(root);
const errors = workspace.problems.filter((p) => p.severity === 'error');
const warnings = workspace.problems.filter((p) => p.severity === 'warning');

if (json) {
  console.log(JSON.stringify(workspace, null, 2));
} else {
  const line = (p: Problem) => `  [${p.check}]${p.record ? ` ${p.record}:` : ''} ${p.message}`;
  console.log(`Checked ${workspace.records.length} records in ${root}`);
  if (errors.length) console.log(`\nErrors (${errors.length}):\n${errors.map(line).join('\n')}`);
  if (warnings.length) console.log(`\nWarnings (${warnings.length}):\n${warnings.map(line).join('\n')}`);
  if (workspace.coverage.length) {
    console.log('\nCoverage:');
    for (const c of workspace.coverage) {
      console.log(
        `  ${c.domain}: requirements ${c.requirements_satisfied}/${c.requirements} satisfied, ${c.requirements_proved}/${c.requirements} proved;` +
          ` rules ${c.rules_satisfied}/${c.rules} satisfied, ${c.rules_proved}/${c.rules} proved; ${c.gaps.length} gaps`,
      );
    }
  }
  console.log(`\n${errors.length} errors, ${warnings.length} warnings.`);
}
process.exitCode = errors.length ? 1 : 0;
