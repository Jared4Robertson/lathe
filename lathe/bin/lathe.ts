#!/usr/bin/env node
// The Lathe command line. Run `lathe help` for usage.
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { CONFIG_FILE, loadConfig, loadWorkspace, type Problem } from '../src/index.ts';
import { slugify } from '../src/server/diagrams.ts';
import { serve } from '../src/server/serve.ts';

const USAGE = `Usage: lathe <command> [options]

Commands:
  init     Set up Lathe in a product repo: writes ${CONFIG_FILE} and a first product record.
           --name "Tool Library" --prefix TL
  check    Load and check the specs. Prints errors, warnings and coverage; exits 1 on any error.
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
        console.log(
          `  ${c.domain}: requirements ${c.requirements_satisfied}/${c.requirements} designed, ${c.requirements_built}/${c.requirements} built, ${c.requirements_proved}/${c.requirements} proved;` +
            ` rules ${c.rules_satisfied}/${c.rules} designed, ${c.rules_built}/${c.rules} built, ${c.rules_proved}/${c.rules} proved; ${c.gaps.length} gaps`,
        );
      }
    }
    console.log(`\n${errors.length} errors, ${warnings.length} warnings.`);
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
