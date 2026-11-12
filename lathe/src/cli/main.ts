// The Lathe command line, loaded by bin/lathe.ts once its packages are found. Run `lathe help` for usage.
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { CONFIG_FILE, loadProducts, mergeDataFiles, SCHEMA_VERSION, SchemaVersionError, upgradeProduct, type Problem, type Workspace } from '../index.ts';
import { forOneCommand } from '../platform/data/store.ts';
import { coverageLines, productFolder } from './operations.ts';
import { strictSummary, type ProductStrictness } from '../checking/product-setting/strictness.ts';
import { INIT_NEXT, InitError, initProduct } from './init.ts';
import { APP_USAGE, runAppCommand } from './app-tools.ts';
import { AGGREGATE_COMMANDS, AGGREGATE_USAGE, runAggregateCommand } from './aggregates.ts';

const USAGE = `Usage: lathe <command> [options]

Commands:
  init     Set up Lathe in a product repo: writes ${CONFIG_FILE} (with this Lathe's schema version,
           ${SCHEMA_VERSION}) and a first product record in data/.
           --name "Tool Library" --prefix TL
  upgrade  Move the product's data forward to this Lathe's schema version, one converter at a time, and
           print what changed and anything left to do by hand. Refuses a git working tree with changes,
           or no git, so the upgrade is one reviewable commit.
  check    Load the data and check it: the product's, and that of each other product its ${CONFIG_FILE}
           lists under products, each on its own. Prints errors, warnings and coverage (one line per domain
           and obligation kind) per product; exits 1 on any error. A product whose check is strict
           (lathe product-setting set-strict-check) fails on any warning beyond those it accepts too,
           as a strict-check error, and on any gap at all, as a strict-gaps error, and its count line
           says it is strict.
           --json prints { products: [{ root, strictness, workspace }] } instead.
  serve    Serve the web app for the product repo and each product it lists.  --port 5330 (default)
           --network also listens on the local network and prints its addresses: other devices on it
           can read, and only this machine can change the spec.
  merge-data <base> <ours> <theirs> <path>
           Git's merge driver for data/*.jsonl files (%O %A %B %P): merges the three versions row by row,
           writes the result over <ours>, and exits 1 on a real clash or a row that breaks its table's rules.
  mcp      Serve every aggregate's commands and queries, and the check, as MCP tools over stdio (the Claude
           Code plugin starts it).

${AGGREGATE_USAGE}
${APP_USAGE}
Options for every command:
  --root <dir>   The product repo (default: the current folder).
`;

// The aggregates' commands read their own flags, one per field, and the app commands theirs.
const appCommand = process.argv[2] === 'app';
// `lathe check` runs the checks, and `lathe check <command>` one of the Check aggregate's commands: an aggregate whose
// name is also one of the commands above is reached with a command after it.
const TOP_COMMANDS = ['init', 'upgrade', 'check', 'serve', 'merge-data', 'mcp', 'help'];
const aggregateCommand =
  AGGREGATE_COMMANDS.includes(process.argv[2] ?? '') && (!TOP_COMMANDS.includes(process.argv[2]) || /^[a-z]/.test(process.argv[3] ?? ''));
const { positionals, values } = parseArgs({
  allowPositionals: true,
  args: appCommand || aggregateCommand ? [] : process.argv.slice(2),
  options: {
    root: { type: 'string' },
    json: { type: 'boolean' },
    name: { type: 'string' },
    prefix: { type: 'string' },
    port: { type: 'string' },
    network: { type: 'boolean' },
    help: { type: 'boolean' },
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
    console.log(JSON.stringify({ products: products.map(({ config, workspace, strictness }) => ({ root: productFolder(root, config.root), strictness, workspace })) }, null, 2));
  } else {
    // Each product is reported on its own; a workspace with several ends with the sum.
    products.forEach(({ config, workspace, strictness }, at) => {
      if (at > 0) console.log('');
      printProduct(config.root, workspace, strictness);
    });
    if (products.length > 1) console.log(`\nAll ${products.length} products: ${count(errors, 'error')}, ${count(sum('warning'), 'warning')}.`);
  }
  process.exitCode = errors ? 1 : 0;
}

/** One product's check: its errors, warnings and coverage, then its counts, and whether its check is strict. */
function printProduct(productRoot: string, workspace: Workspace, strictness: ProductStrictness[]) {
  const errors = workspace.problems.filter((p) => p.severity === 'error');
  const warnings = workspace.problems.filter((p) => p.severity === 'warning');
  const line = (p: Problem) => `  [${p.check}]${p.record ? ` ${p.record}:` : ''} ${p.message}`;
  console.log(`Checked ${workspace.records.length} records in ${productRoot}`);
  if (errors.length) console.log(`\nErrors (${errors.length}):\n${errors.map(line).join('\n')}`);
  if (warnings.length) console.log(`\nWarnings (${warnings.length}):\n${warnings.map(line).join('\n')}`);
  const covered = coverageLines(workspace.coverage);
  if (covered.length) console.log(`\nCoverage:\n${covered.join('\n')}`);
  console.log(`\n${[`${count(errors.length, 'error')}, ${count(warnings.length, 'warning')}.`, ...strictness.map(strictSummary).filter(Boolean)].join(' ')}`);
}

async function init() {
  try {
    for (const line of await initProduct(root, values.name, values.prefix)) console.log(line);
  } catch (error) {
    if (error instanceof InitError) fail(error.message);
    throw error;
  }
  console.log(`\n${INIT_NEXT}`);
}

// The server and the MCP server are loaded only for their own commands, so every other command starts sooner.
async function startServer() {
  const port = Number(values.port ?? 5330);
  if (!Number.isInteger(port) || port <= 0) fail('--port must be a port number.');
  const { LOOPBACK_HOST, NETWORK_HOST, networkUrls, serve } = await import('../server/serve.ts');
  const network = values.network === true;
  let running: ReturnType<typeof serve>;
  try {
    running = serve({ root, port, host: network ? NETWORK_HOST : LOOPBACK_HOST });
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
  running.server.on('listening', () => {
    console.log(`Lathe is serving ${root} at http://${LOOPBACK_HOST}:${port}`);
    if (!network) return;
    // Opt-in only (LA-PLT-UC23-R04): each address other devices on the network open, read-only for them.
    const urls = networkUrls(networkInterfaces(), port);
    if (!urls.length) console.log('No network address was found: other devices cannot reach it yet.');
    for (const url of urls) console.log(`On the network (read only): ${url}`);
  });
  running.server.on('error', (error) => fail(`Could not start the server: ${error.message}`));
  // Stopped from a terminal: stop cleanly (LA-PLT-UC23-R02), then end by the same signal, as before. A second signal,
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
    result = await upgradeProduct(root);
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

// Every command but serve and mcp ends when it is done.
if (command !== 'serve' && command !== 'mcp') forOneCommand();
try {
  if (aggregateCommand) {
    process.exitCode = await runAggregateCommand(process.argv.slice(2));
  } else if (appCommand) {
    process.exitCode = await runAppCommand(process.argv.slice(2));
  } else if (values.help || command === 'help') {
    console.log(USAGE);
  } else if (command === 'check') {
    await check();
  } else if (command === 'init') {
    await init();
  } else if (command === 'upgrade') {
    await upgrade();
  } else if (command === 'serve') {
    await startServer();
  } else if (command === 'mcp') {
    const { serveMcp } = await import('./mcp.ts');
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
