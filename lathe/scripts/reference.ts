// Writes the reference as Markdown: every kind with its table, the other tables, the relations, the folders and the
// checks, from the schema and the check rows. With no options it writes Lathe's own, lathe/REFERENCE.md.
//
//   node lathe/scripts/reference.ts [--root <product repo>] [--out <file> | --print]
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { buildReference, PACKAGE_DIR, renderReference } from '../src/index.ts';

const { values } = parseArgs({ options: { root: { type: 'string' }, out: { type: 'string' }, print: { type: 'boolean' } } });
const markdown = renderReference(await buildReference(path.resolve(values.root ?? PACKAGE_DIR)));
if (values.print) process.stdout.write(markdown);
else {
  const file = path.resolve(values.out ?? path.join(PACKAGE_DIR, 'REFERENCE.md'));
  writeFileSync(file, markdown);
  console.log(`Wrote ${path.relative(process.cwd(), file) || file}`);
}
