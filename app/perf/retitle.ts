// Retitles records in one write, as an Agent writes (LA-V96-R29-T02): reads [{ kind, id, title }] as JSON on stdin and runs
// each record's own Change command (`change-<kind>`, its title field) together in one transaction, one commit, on the
// product at --root. Prints the kinds it has no such command for, and exits 1, without writing anything. With --kinds it
// prints the kinds it can retitle, as JSON, and writes nothing.
import { readFileSync } from 'node:fs';
import { ALL_COMMANDS, openStore } from '../../lathe/src/index.ts';
import { closeEngine } from '../../lathe/src/platform/data/store.ts';
import { runCommands } from '../../lathe/src/platform/commands/run.ts';

const commandOf = (kind: string) => ALL_COMMANDS.find((c) => c.name === `change-${kind.replaceAll('_', '-')}` && 'title' in c.input);
if (process.argv.includes('--kinds')) {
  console.log(JSON.stringify(ALL_COMMANDS.filter((c) => c.name.startsWith('change-') && 'title' in c.input).map((c) => c.name.slice('change-'.length).replaceAll('-', '_'))));
  process.exit(0);
}
const root = process.argv[process.argv.indexOf('--root') + 1];
const titles = JSON.parse(readFileSync(0, 'utf8')) as { kind: string; id: string; title: string }[];
const missing = [...new Set(titles.filter((t) => !commandOf(t.kind)).map((t) => t.kind))];
if (missing.length > 0) {
  console.error(`no change command for ${missing.join(', ')}`);
  process.exit(1);
}
const store = await openStore(root);
try {
  await runCommands(store, titles.map((t) => [commandOf(t.kind)!, { id: t.id, title: t.title }] as const));
} finally {
  await store.close();
  await closeEngine();
}
