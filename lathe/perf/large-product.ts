// The large product (LA-PLT-TD04): a synthetic product about ten times Lathe's own spec, built through the aggregates'
// own commands, so every row it holds is one the commands would write and every rule holds. It is deterministic: the
// same code makes the same files, byte for byte (its words and links come from a fixed seed). The perf suite and the
// big-map tests read it.
//
//   node lathe/perf/large-product.ts [folder]    writes it to the folder (default: the cache, below) and prints where
//
// Building it takes minutes, so it is kept in the cache folder under a name made of a hash of this file and the schema's
// migrations (largeProduct() builds it again only when either changes). Its shape, per domain: sixteen use cases
// (three requirements with a test each, a flow of four steps fulfilling them, offered through both
// interfaces, and a flow test), four aggregates (three entities, two invariants with tests, four commands with handlers), two read models
// (three queries with handlers), and ten terms. DOMAINS domains make about 64,000 records.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADD_AGGREGATE } from '../src/domain-modeling/aggregate/commands/add-aggregate.ts';
import { ADD_ENTITY } from '../src/domain-modeling/aggregate/commands/add-entity.ts';
import { ADD_INVARIANT } from '../src/domain-modeling/aggregate/commands/add-invariant.ts';
import { ADD_INVARIANT_TEST } from '../src/domain-modeling/aggregate/commands/add-invariant-test.ts';
import { ADD_COMMAND } from '../src/domain-modeling/command/commands/add-command.ts';
import { ADD_COMMAND_HANDLER } from '../src/domain-modeling/command/commands/add-command-handler.ts';
import { ADD_DOMAIN } from '../src/domain-modeling/domain/commands/add-domain.ts';
import { ADD_TERM } from '../src/domain-modeling/domain/commands/add-term.ts';
import { ADD_INTERFACE } from '../src/product/interface/commands/add-interface.ts';
import { ADD_PRODUCT } from '../src/product/product/commands/add-product.ts';
import { ADD_QUERY } from '../src/domain-modeling/read-model/commands/add-query.ts';
import { ADD_QUERY_HANDLER } from '../src/domain-modeling/read-model/commands/add-query-handler.ts';
import { ADD_READ_MODEL } from '../src/domain-modeling/read-model/commands/add-read-model.ts';
import { ADD_FLOW } from '../src/use-cases/use-case/commands/add-flow.ts';
import { ADD_FLOW_STEP } from '../src/use-cases/use-case/commands/add-flow-step.ts';
import { ADD_FLOW_TEST } from '../src/use-cases/use-case/commands/add-flow-test.ts';
import { ADD_UC_REQUIREMENT } from '../src/use-cases/use-case/commands/add-uc-requirement.ts';
import { ADD_USE_CASE } from '../src/use-cases/use-case/commands/add-use-case.ts';
import { ADD_USE_CASE_TEST } from '../src/use-cases/use-case/commands/add-use-case-test.ts';
import { CONFIG_FILE, SCHEMA_VERSION } from '../src/config.ts';
import type { AnyCommand } from '../src/platform/commands/definition.ts';
import { runCommands } from '../src/platform/commands/run.ts';
import { SCHEMA_DIR } from '../src/platform/data/schema.ts';
import { closeEngine, openStore } from '../src/platform/data/store.ts';

const here = path.dirname(fileURLToPath(import.meta.url));

/** The product's ID. */
export const LARGE_PRODUCT = 'LP';
/** How many domains it has: about 400 records each. */
export const DOMAINS = 160;
/** How many domains go into one write. */
const DOMAINS_PER_WRITE = 20;

// A fixed-seed generator (mulberry32), so the words and links are the same every time.
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NOUNS = ['tool', 'loan', 'member', 'invoice', 'shelf', 'order', 'parcel', 'voyage', 'ticket', 'visit', 'batch', 'report', 'account', 'booking', 'claim', 'lesson'];
const VERBS = ['Lend', 'Return', 'Register', 'Approve', 'Ship', 'Plan', 'Book', 'Settle', 'Review', 'Schedule', 'Close', 'Renew', 'Assign', 'Track', 'Price', 'Count'];
const pad = (n: number) => String(n).padStart(2, '0');
// A domain's code: two letters, then a number, unique for every domain.
const domainCode = (d: number) => `D${String(d + 1).padStart(3, '0')}`;

type Step = readonly [AnyCommand, Record<string, unknown>];

/** The commands that write one domain, in an order each can run in. */
function domainSteps(d: number, useCases: string[]): Step[] {
  const next = random(d + 1);
  const pick = <T,>(items: readonly T[]) => items[Math.floor(next() * items.length)];
  const domain = `${LARGE_PRODUCT}-${domainCode(d)}`;
  const noun = NOUNS[d % NOUNS.length];
  const steps: Step[] = [[ADD_DOMAIN, { id: domain, title: `${noun[0].toUpperCase()}${noun.slice(1)} handling ${d + 1}`, product_id: LARGE_PRODUCT, position: d + 1, subdomain_type: d % 3 ? 'supporting' : 'core', description: `Everything about the ${noun}s of area ${d + 1}.` }]];
  for (let t = 1; t <= 10; t++) {
    steps.push([ADD_TERM, { id: `${domain}-TM${pad(t)}`, title: `${pick(NOUNS)} ${pick(NOUNS)} ${d + 1}-${t}`, domain_id: domain, meaning: `A thing area ${d + 1} keeps, number ${t}.` }]);
  }
  // Aggregates, with their entities, invariants and commands.
  let entity = 0;
  let invariant = 0;
  let command = 0;
  for (let a = 1; a <= 4; a++) {
    const aggregate = `${domain}-A${a}`;
    steps.push([ADD_AGGREGATE, { id: aggregate, title: `${pick(NOUNS)} ${d + 1}.${a}`.replace(/^./, (c) => c.toUpperCase()), domain_id: domain, description: `One ${noun} and what it holds.`, identity: `${noun} ID` }]);
    const entities: string[] = [];
    for (let e = 0; e < 3; e++) {
      const id = `${domain}-EN${pad(++entity)}`;
      entities.push(id);
      steps.push([ADD_ENTITY, { id, title: `${pick(NOUNS)} part ${d + 1}.${entity}`.replace(/^./, (c) => c.toUpperCase()), aggregate_id: aggregate, role: e === 0 ? 'root' : 'child', description: `Part ${e + 1} of the aggregate.`, fields: [{ name: 'Name', meaning: 'What it is called.', type: 'text', required: true }] }]);
    }
    for (let i = 0; i < 2; i++) {
      const id = `${domain}-INV${pad(++invariant)}`;
      steps.push([ADD_INVARIANT, { id, title: `A ${noun} keeps rule ${d + 1}.${invariant}`, aggregate_id: aggregate, statement: `A ${noun} MUST keep rule ${invariant}.` }]);
      steps.push([ADD_INVARIANT_TEST, { id: `${id}-T`, title: `rule ${d + 1}.${invariant} is kept`, invariant_id: id, level: 'unit', state: 'automated', file: `test/${domainCode(d)}.test.ts`, when: 'Breaks the rule.', then: 'Expects a refusal.' }]);
    }
    for (let c = 0; c < 4; c++) {
      const id = `${domain}-CMD${pad(++command)}`;
      steps.push([ADD_COMMAND, { id, title: `${pick(VERBS)} ${noun} ${d + 1}.${command}`, entity_id: entities[c % entities.length], description: `Changes a ${noun}.` }]);
      steps.push([ADD_COMMAND_HANDLER, { id: `${id}-H`, title: `handle${domainCode(d)}x${command}`, command_id: id, file: `src/${domainCode(d)}/commands.ts`, description: 'Loads and saves through its repository.' }]);
    }
  }
  // Read models, each with its queries.
  let query = 0;
  for (let r = 1; r <= 2; r++) {
    const readModel = `${domain}-RM${pad(r)}`;
    steps.push([ADD_READ_MODEL, { id: readModel, title: `${noun} list ${d + 1}.${r}`.replace(/^./, (c) => c.toUpperCase()), domain_id: domain, description: `The ${noun}s as the area lists them.`, fields: [{ name: 'Name', meaning: 'What it is called.', type: 'text', required: true }], reads: [`${domain}-A${r}`] }]);
    for (let q = 0; q < 3; q++) {
      const id = `${domain}-QRY${pad(++query)}`;
      steps.push([ADD_QUERY, { id, title: `List ${noun}s by ${pick(NOUNS)} ${d + 1}.${query}`, read_model_id: readModel, description: `Lists ${noun}s.` }]);
      steps.push([ADD_QUERY_HANDLER, { id: `${id}-H`, title: `list${domainCode(d)}x${query}`, query_id: id, file: `src/${domainCode(d)}/queries.ts`, description: 'Reads from its reader.' }]);
    }
  }
  // The domain's use cases, four at a time.
  let useCase = 0;
  for (let c = 1; c <= 4; c++) {
    for (let u = 0; u < 4; u++) {
      const uc = `${domain}-UC${pad(++useCase)}`;
      const title = `${pick(VERBS)} ${noun} ${d + 1}.${useCase}`;
      steps.push([ADD_USE_CASE, { id: uc, title, domain_id: domain, goal: `The Owner gets a ${noun} through step ${useCase}.`, result_id: `${domain}-CMD${pad(((useCase - 1) % command) + 1)}`, actors: ['Owner'] }]);
      const requirements: string[] = [];
      for (let q = 1; q <= 3; q++) {
        const id = `${uc}-R${pad(q)}`;
        requirements.push(id);
        steps.push([ADD_UC_REQUIREMENT, { id, title: `The ${noun} is right ${d + 1}.${useCase}.${q}`, use_case_id: uc, statement: `The ${noun} MUST be right, part ${q}.` }]);
        steps.push([ADD_USE_CASE_TEST, { id: `${id}-T01`, title: `the ${noun} is right ${d + 1}.${useCase}.${q}`, uc_requirement_id: id, level: 'service', state: 'automated', file: `test/${domainCode(d)}.test.ts`, when: 'Runs the use case.', then: 'Expects it right.' }]);
      }
      useCases.push(uc);
      const flow = `${uc}-FL`;
      steps.push([ADD_FLOW, { id: flow, title, use_case_id: uc }]);
      for (let s = 1; s <= 4; s++) {
        steps.push([ADD_FLOW_STEP, { id: `${flow}-S${pad(s)}`, title: `The Owner does step ${d + 1}.${useCase}.${s}`, flow_id: flow, path: 'main', position: s, fulfills: [requirements[(s - 1) % requirements.length]] }]);
      }
      steps.push([ADD_FLOW_TEST, { id: `${flow}-T`, title: `${title} works`, flow_id: flow, level: 'browser', state: 'automated', file: `test/${domainCode(d)}.spec.ts`, steps: ['Does the steps'], expected_result: 'Expects it done.' }]);
    }
  }
  return steps;
}

/** Writes the large product to the folder (made afresh): its config and its data files, written by its commands. */
export async function writeLargeProduct(root: string, domains = DOMAINS): Promise<void> {
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
  writeFileSync(path.join(root, CONFIG_FILE), `${JSON.stringify({ schema: SCHEMA_VERSION })}\n`);
  const store = await openStore(root, { latheDataDir: null });
  try {
    await runCommands(store, [
      [ADD_PRODUCT, { id: LARGE_PRODUCT, title: 'Large product', description: 'A synthetic product about ten times Lathe\'s own spec, for the performance budgets.', roles: [{ name: 'Owner', description: 'Decides what the product is for.' }] }],
    ]);
    const useCases: string[] = [];
    for (let d = 0; d < domains; d += DOMAINS_PER_WRITE) {
      const steps = Array.from({ length: Math.min(DOMAINS_PER_WRITE, domains - d) }, (_, i) => domainSteps(d + i, useCases)).flat();
      await runCommands(store, steps);
    }
    // Both interfaces offer every use case, used by the Owner.
    await runCommands(store, [
      [ADD_INTERFACE, { id: `${LARGE_PRODUCT}-IF01`, title: 'Web app', product_id: LARGE_PRODUCT, kind: 'web app', description: 'The pages.', public: false, actors: ['Owner'], offers: useCases }],
      [ADD_INTERFACE, { id: `${LARGE_PRODUCT}-IF02`, title: 'CLI', product_id: LARGE_PRODUCT, kind: 'CLI', description: 'The command line.', public: false, actors: ['Owner'], offers: useCases }],
    ]);
  } finally {
    await store.close();
  }
}

/** What the product depends on: this file and the schema's migrations, as one hash. */
function largeProductKey(): string {
  const hash = createHash('sha256');
  hash.update(readFileSync(fileURLToPath(import.meta.url), 'utf8'));
  for (const name of readdirSync(SCHEMA_DIR).filter((f) => f.endsWith('.sql')).sort()) hash.update(`${name}\0${readFileSync(path.join(SCHEMA_DIR, name), 'utf8')}\0`);
  return hash.digest('hex').slice(0, 16);
}

/** The folder the large product is kept in: node_modules/.cache/lathe-large-product in the package. */
export const LARGE_PRODUCT_CACHE = path.join(here, '..', 'node_modules', '.cache', 'lathe-large-product');

/** Where the large product of this code is kept, built or not. */
export const largeProductFolder = (): string => path.join(LARGE_PRODUCT_CACHE, largeProductKey());

/** The large product's folder, built when the cache has none for this code. Read it; copy it before writing to it. */
export async function largeProduct(): Promise<string> {
  const folder = largeProductFolder();
  if (existsSync(path.join(folder, CONFIG_FILE))) return folder;
  const building = `${folder}.${process.pid}.tmp`;
  await writeLargeProduct(building);
  // Products built from older code are left behind; only this one is kept.
  for (const name of readdirSync(LARGE_PRODUCT_CACHE)) if (path.join(LARGE_PRODUCT_CACHE, name) !== building) rmSync(path.join(LARGE_PRODUCT_CACHE, name), { recursive: true, force: true });
  renameSync(building, folder);
  return folder;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  const start = performance.now();
  const folder = target ? (await writeLargeProduct(path.resolve(target)), path.resolve(target)) : await largeProduct();
  await closeEngine();
  console.log(`The large product is in ${folder} (${Math.round(performance.now() - start)} ms).`);
}
