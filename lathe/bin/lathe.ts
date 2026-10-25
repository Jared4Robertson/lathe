#!/usr/bin/env node
// The Lathe command line. Run `lathe help` for usage.
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { CONFIG_FILE, loadConfig, loadWorkspace, type Problem } from '../src/index.ts';
import { slugify } from '../src/server/diagrams.ts';
import { serve } from '../src/server/serve.ts';

/** A label inside a sentence: "Use case" -> "use case", but an acronym keeps its case ("UC requirement"). */
const lowerLabel = (label: string) => (/^[A-Z]{2}/.test(label) ? label : label.charAt(0).toLowerCase() + label.slice(1));

const USAGE = `Usage: lathe <command> [options]

Commands:
  init     Set up Lathe in a product repo: writes ${CONFIG_FILE} and a first product record.
           --name "Tool Library" --prefix TL
  check    Load and check the specs. Prints errors, warnings and coverage (one line per domain and
           obligation kind); exits 1 on any error.
           --json prints the whole workspace instead.
  serve    Serve the web app for the product repo.  --port 5330 (default)

Options for every command:
  --root <dir>   The product repo (default: the current folder).
`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    root: { type: 'string' },
    json: { type: 'boolean' },
    name: { type: 'string' },
    prefix: { type: 'string' },
    port: { type: 'string' },
    help: { type: 'boolean' },
  },
});
const command = positionals[0] ?? 'help';
const root = path.resolve(values.root ?? process.cwd());

function fail(message: string): never {
  console.error(message);
  process.exit(2);
}

async function check() {
  const workspace = await loadWorkspace(root);
  const errors = workspace.problems.filter((p) => p.severity === 'error');
  const warnings = workspace.problems.filter((p) => p.severity === 'warning');
  if (values.json) {
    console.log(JSON.stringify(workspace, null, 2));
  } else {
    const line = (p: Problem) => `  [${p.check}]${p.record ? ` ${p.record}:` : ''} ${p.message}`;
    console.log(`Checked ${workspace.records.length} records in ${root}`);
    if (errors.length) console.log(`\nErrors (${errors.length}):\n${errors.map(line).join('\n')}`);
    if (warnings.length) console.log(`\nWarnings (${warnings.length}):\n${warnings.map(line).join('\n')}`);
    if (workspace.coverage.length) {
      console.log('\nCoverage:');
      for (const c of workspace.coverage) {
        const counted = c.obligations.filter((o) => o.total > 0);
        if (!counted.length) console.log(`  ${c.domain}: no obligations`);
        for (const o of counted) {
          const gaps = c.gaps.filter((g) => g.kind === o.kind).length;
          const of = (n: number) => `${n}/${o.total}`;
          // planned_any is shown only where it differs: some proved obligations still have planned tests.
          const owed = o.planned_any !== undefined && o.planned_any !== o.planned ? `; ${of(o.planned_any)} with a planned test` : '';
          // A proof-only kind (such as a pattern rule) is not asked to be designed or built.
          const proofOnly = workspace.kinds.find((k) => k.kind === o.kind)?.proof_only;
          const design = proofOnly ? 'proof only' : `${of(o.designed)} designed, ${of(o.built)} built`;
          console.log(
            `  ${c.domain} ${lowerLabel(o.label)}: ${design}, ${of(o.proved)} proved, ${of(o.planned)} planned; ${gaps} ${gaps === 1 ? 'gap' : 'gaps'}${owed}`,
          );
        }
        if (c.tests) console.log(`  ${c.domain} tests: ${c.tests.automated} automated, ${c.tests.manual} manual, ${c.tests.planned} planned`);
      }
    }
    const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;
    console.log(`\n${count(errors.length, 'error')}, ${count(warnings.length, 'warning')}.`);
  }
  process.exitCode = errors.length ? 1 : 0;
}

async function init() {
  const name = values.name?.trim();
  const prefix = values.prefix?.trim();
  if (!name || !prefix) fail('lathe init needs --name and --prefix, for example: lathe init --name "Tool Library" --prefix TL');
  if (!/^[A-Z][A-Z0-9]*$/.test(prefix)) fail('--prefix must be capital letters and digits, starting with a letter, such as TL.');

  const configFile = path.join(root, CONFIG_FILE);
  if (!existsSync(configFile)) {
    await writeFile(configFile, `${JSON.stringify({ specs: 'specs', diagrams: 'diagrams' }, null, 2)}\n`);
    console.log(`Wrote ${CONFIG_FILE}`);
  }
  const config = loadConfig(root);
  const productDir = path.join(config.specsDir, slugify(name));
  const productFile = path.join(productDir, 'product.md');
  if (existsSync(productFile)) fail(`${path.relative(root, productFile)} already exists.`);
  await mkdir(productDir, { recursive: true });
  await writeFile(productFile, `---\nid: ${prefix}\nkind: product\ntitle: ${name}\n---\nWhat ${name} is, who it is for, and what it must do.\n`);
  console.log(`Wrote ${path.relative(root, productFile)}`);
  console.log(`\nNext: add a domain under ${path.relative(root, productDir)}/, then run \`lathe check\`. The record format is in the Lathe package's FORMAT.md.`);
}

function startServer() {
  const port = Number(values.port ?? 5330);
  if (!Number.isInteger(port) || port <= 0) fail('--port must be a port number.');
  let server: ReturnType<typeof serve>;
  try {
    server = serve({ root, port });
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
  server.on('listening', () => console.log(`Lathe is serving ${root} at http://127.0.0.1:${port}`));
  server.on('error', (error) => fail(`Could not start the server: ${error.message}`));
}

if (values.help || command === 'help') {
  console.log(USAGE);
} else if (command === 'check') {
  await check();
} else if (command === 'init') {
  await init();
} else if (command === 'serve') {
  startServer();
} else {
  fail(`Unknown command "${command}".\n\n${USAGE}`);
}
