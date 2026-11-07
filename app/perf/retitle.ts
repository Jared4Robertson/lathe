// Retitles records in one write, as an Agent writes (LA-V96-R29-T02): reads [{ kind, id, title }] as JSON on stdin and runs
// each record's own Change command (`change-<kind>`, its title field) together in one transaction, one commit, on the
// product at --root. Prints the kinds it has no such command for, and exits 1, without writing anything. With --kinds it
// prints the kinds it can retitle, as JSON, and writes nothing. With --count N it writes the first N of the records whose
// new title the store accepts, leaving out any a write rule refuses (an essential record whose title already names a
// technology, say, is refused any new title), and prints those it wrote, as JSON.
import { readFileSync } from 'node:fs';
import { ALL_COMMANDS, openStore } from '../../lathe/src/index.ts';
import { StoreError } from '../../lathe/src/platform/data/problems.ts';
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
const count = process.argv.includes('--count') ? Number(process.argv[process.argv.indexOf('--count') + 1]) : titles.length;
const store = await openStore(root);
try {
  const refused = new Set<string>();
  for (;;) {
    const chosen = titles.filter((t) => !refused.has(t.id)).slice(0, count);
    try {
      await runCommands(store, chosen.map((t) => [commandOf(t.kind)!, { id: t.id, title: t.title }] as const));
      console.log(JSON.stringify(chosen));
      break;
    } catch (e) {
      // A refusal changes nothing: leave out the records it names and write the rest, or give up when it names none of them.
      const named = e instanceof StoreError ? e.problems.map((p) => p.key).filter((k): k is string => !!k && chosen.some((t) => t.id === k)) : [];
      if (named.length === 0) throw e;
      for (const id of named) refused.add(id);
    }
  }
} finally {
  await store.close();
  await closeEngine();
}
