#!/usr/bin/env node
// The Lathe command line. Run `lathe help` for usage.
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { CONFIG_FILE, exceptionsText, loadProducts, mergeDataFiles, openStore, SCHEMA_VERSION, SchemaVersionError, StoreError, upgradeProduct, type Problem, type Workspace } from '../src/index.ts';
import { serve } from '../src/server/serve.ts';
import { serveMcp } from '../src/cli/mcp.ts';
import { DATA_COMMANDS, DATA_USAGE, runDataCommand } from '../src/cli/writers.ts';

/** A label inside a sentence: "Use case" -> "use case", but an acronym keeps its case ("UC requirement"). */
const lowerLabel = (label: string) => (/^[A-Z]{2}/.test(label) ? label : label.charAt(0).toLowerCase() + label.slice(1));

const USAGE = `Usage: lathe <command> [options]

Commands:
  init     Set up Lathe in a product repo: writes ${CONFIG_FILE} (with this Lathe's schema version,
           ${SCHEMA_VERSION}) and a first product record in data/.
           --name "Tool Library" --prefix TL
  upgrade  Move the product's data forward to this Lathe's schema version, one converter at a time, and
           print what changed and anything left to do by hand. Refuses a git working tree with changes,
           so the upgrade is one reviewable commit.
           --allow-dirty upgrades anyway.
  check    Load the data and check it: the product's, and that of each other product its ${CONFIG_FILE}
           lists under products, each on its own. Prints errors, warnings, the recorded exceptions (each
           command that also changes another aggregate, with its reason) and coverage (one line per domain
           and obligation kind) per product; exits 1 on any error.
           --json prints { products: [{ root, workspace }] } instead.
  serve    Serve the web app for the product repo and each product it lists.  --port 5330 (default)
  merge-data <base> <ours> <theirs> <path>
           Git's merge driver for data/*.jsonl files (%O %A %B %P): merges the three versions row by row,
           writes the result over <ours>, and exits 1 on a real clash or a row that breaks its table's rules.
  mcp      Serve the data commands as MCP tools over stdio (the Claude Code plugin starts it).

${DATA_USAGE}
Options for every command:
  --root <dir>   The product repo (default: the current folder).
`;

// The data commands read their own flags, one per column of the schema.
const dataCommand = (DATA_COMMANDS as readonly string[]).includes(process.argv[2] ?? '');
const { positionals, values } = parseArgs({
  allowPositionals: true,
  args: dataCommand ? [] : process.argv.slice(2),
  options: {
    root: { type: 'string' },
    json: { type: 'boolean' },
    name: { type: 'string' },
    prefix: { type: 'string' },
    port: { type: 'string' },
    help: { type: 'boolean' },
    'allow-dirty': { type: 'boolean' },
  },
});
const command = positionals[0] ?? 'help';
const root = path.resolve(values.root ?? process.cwd());

function fail(message: string): never {
  console.error(message);
  process.exit(2);
}

/** "1 error", "2 warnings". */
const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;

async function check() {
  const products = await loadProducts(root);
  const sum = (severity: Problem['severity']) => products.reduce((n, { workspace }) => n + workspace.problems.filter((p) => p.severity === severity).length, 0);
  const errors = sum('error');
  if (values.json) {
    const folder = (dir: string) => path.relative(root, dir).split(path.sep).join('/') || '.';
    console.log(JSON.stringify({ products: products.map(({ config, workspace }) => ({ root: folder(config.root), workspace })) }, null, 2));
  } else {
    // Each product is reported on its own; a workspace with several ends with the sum.
    products.forEach(({ config, workspace }, at) => {
      if (at > 0) console.log('');
      printProduct(config.root, workspace);
    });
    if (products.length > 1) console.log(`\nAll ${products.length} products: ${count(errors, 'error')}, ${count(sum('warning'), 'warning')}.`);
  }
  process.exitCode = errors ? 1 : 0;
}

/** One product's check: its errors, warnings, recorded exceptions and coverage, then its counts. */
function printProduct(productRoot: string, workspace: Workspace) {
  const errors = workspace.problems.filter((p) => p.severity === 'error');
  const warnings = workspace.problems.filter((p) => p.severity === 'warning');
  const line = (p: Problem) => `  [${p.check}]${p.record ? ` ${p.record}:` : ''} ${p.message}`;
  console.log(`Checked ${workspace.records.length} records in ${productRoot}`);
  if (errors.length) console.log(`\nErrors (${errors.length}):\n${errors.map(line).join('\n')}`);
  if (warnings.length) console.log(`\nWarnings (${warnings.length}):\n${warnings.map(line).join('\n')}`);
  if (workspace.exceptions.length) console.log(`\n${exceptionsText(workspace.exceptions)}`);
  if (workspace.coverage.length) {
    console.log('\nCoverage:');
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
        console.log(`  ${scope} ${lowerLabel(o.label)}: ${design}, ${of(o.proved)} proved${waiting}`);
        for (const g of c.gaps.filter((x) => x.kind === o.kind && kinds.has(x.kind) && ['designed', 'built', 'proved'].includes(x.missing))) console.log(`    gap: ${g.message}`);
      }
      if (tested) console.log(`  ${scope} tests: ${c.tests.automated} automated, ${c.tests.manual} manual, ${c.tests.not_automated} not automated yet`);
      if (minimums.length) {
        console.log(`  ${scope} records short of a minimum (${minimums.length}):`);
        for (const g of minimums) console.log(`    [${g.missing}] ${g.message}`);
      }
    }
  }
  console.log(`\n${count(errors.length, 'error')}, ${count(warnings.length, 'warning')}.`);
}

async function init() {
  const name = values.name?.trim();
  const prefix = values.prefix?.trim();
  if (!name || !prefix) fail('lathe init needs --name and --prefix, for example: lathe init --name "Tool Library" --prefix TL');
  if (!/^[A-Z][A-Z0-9]*$/.test(prefix)) fail('--prefix must be capital letters and digits, starting with a letter, such as TL.');

  const configFile = path.join(root, CONFIG_FILE);
  if (!existsSync(configFile)) {
    await writeFile(configFile, `${JSON.stringify({ schema: SCHEMA_VERSION, data: 'data' }, null, 2)}\n`);
    console.log(`Wrote ${CONFIG_FILE}`);
  }
  const store = await openStore(root);
  try {
    if (store.record(prefix)) fail(`The product ${prefix} already exists.`);
    const { files } = await store.add('product', { id: prefix, title: name, description: `What ${name} is, who it is for, and what it must do.` });
    for (const file of files) console.log(`Wrote ${path.relative(root, path.join(store.dataDir, file))}`);
  } catch (error) {
    if (error instanceof StoreError) fail(error.message);
    throw error;
  } finally {
    await store.close();
  }
  console.log('\nNext: add a domain under the product, with its subdomain_type, then its aggregates, commands and events (`lathe add --help`), and run `lathe check`. The tables and their columns are in REFERENCE.md.');
}

function startServer() {
  const port = Number(values.port ?? 5330);
  if (!Number.isInteger(port) || port <= 0) fail('--port must be a port number.');
  let running: ReturnType<typeof serve>;
  try {
    running = serve({ root, port });
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
  running.server.on('listening', () => console.log(`Lathe is serving ${root} at http://127.0.0.1:${port}`));
  running.server.on('error', (error) => fail(`Could not start the server: ${error.message}`));
  // Stopped from a terminal: stop cleanly (LA-PLT-UC02-R06), then end by the same signal, as before. A second signal,
  // or a stop that takes longer than STOP_TIMEOUT, ends it at once.
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      const end = () => process.kill(process.pid, signal);
      setTimeout(end, STOP_TIMEOUT).unref();
      void running.stop().finally(end);
    });
  }
}

/** The longest `lathe serve` waits for its server to stop on SIGINT or SIGTERM. */
const STOP_TIMEOUT = 10_000;

async function upgrade() {
  let result: Awaited<ReturnType<typeof upgradeProduct>>;
  try {
    result = await upgradeProduct(root, { allowDirty: values['allow-dirty'] ?? false });
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
  if (result.from === result.to && result.done) {
    console.log(`${root} is already at schema ${result.to}; there is nothing to upgrade.`);
    return;
  }
  console.log(result.done ? `Upgraded ${root} from schema ${result.from} to schema ${result.to}.` : `The upgrade of ${root} stopped: its data is still for schema ${result.from}.`);
  for (const step of result.steps) {
    console.log(`\n${step.name}:`);
    console.log(step.changes.length ? step.changes.map((c) => `  ${c}`).join('\n') : '  no changes');
  }
  if (result.done) console.log(`\n${CONFIG_FILE}: schema ${result.from} -> ${result.to}`);
  if (result.todos.length) console.log(`\nTo do by hand (${result.todos.length}):\n${result.todos.map((t) => `  - ${t}`).join('\n')}`);
  console.log(result.done
    ? '\nNext: run `lathe check`, review the changes with `git diff`, and commit them as one commit.'
    : '\nNothing was committed. Fix the to-dos and run `lathe upgrade` again, or undo the half-converted files with `git checkout -- .`.');
  process.exitCode = result.done ? 0 : 1;
}

async function mergeData() {
  const [base, ours, theirs, file] = positionals.slice(1);
  if (!base || !ours || !theirs || !file) fail('lathe merge-data needs <base> <ours> <theirs> <path>, as git passes them: %O %A %B %P.');
  const result = await mergeDataFiles(base, ours, theirs, file);
  for (const clash of result.clashes) console.error(`${file}: ${clash}`);
  for (const problem of result.problems) console.error(`${file}: ${problem}`);
  process.exitCode = result.clashes.length || result.problems.length ? 1 : 0;
}

try {
  if (dataCommand) {
    process.exitCode = await runDataCommand(process.argv.slice(2));
  } else if (values.help || command === 'help') {
    console.log(USAGE);
  } else if (command === 'check') {
    await check();
  } else if (command === 'init') {
    await init();
  } else if (command === 'upgrade') {
    await upgrade();
  } else if (command === 'serve') {
    startServer();
  } else if (command === 'mcp') {
    await serveMcp(root);
  } else if (command === 'merge-data') {
    await mergeData();
  } else {
    fail(`Unknown command "${command}".\n\n${USAGE}`);
  }
} catch (error) {
  // A product whose data is for another schema: one clear message, never a stack trace.
  if (error instanceof SchemaVersionError) fail(error.message);
  throw error;
}
