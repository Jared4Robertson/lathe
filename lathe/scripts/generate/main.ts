// `npm run generate`: writes every generated file from Lathe's records (outputs.ts), removes a generated
// file no output makes any more, then scaffolds what is not written yet (a command's file, a query's definition).
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { GENERATED_HEADER, GENERATED_ROOTS } from './output.ts';
import { generatedFiles, scaffoldFiles } from './outputs.ts';

const REPO = path.join(import.meta.dirname, '..', '..', '..');

/** Every file under the generated roots whose first line is the generated header, from the repo root. */
function generatedOnDisk(dir: string): string[] {
  return readdirSync(path.join(REPO, dir)).flatMap((name) => {
    const rel = `${dir}/${name}`;
    if (statSync(path.join(REPO, rel)).isDirectory()) return name === 'node_modules' ? [] : generatedOnDisk(rel);
    return name.endsWith('.ts') && readFileSync(path.join(REPO, rel), 'utf8').startsWith(GENERATED_HEADER) ? [rel] : [];
  });
}

const write = (file: string, text: string) => {
  mkdirSync(path.dirname(path.join(REPO, file)), { recursive: true });
  writeFileSync(path.join(REPO, file), text);
};

const files = await generatedFiles(REPO);
let written = 0;
for (const [file, text] of files) {
  const full = path.join(REPO, file);
  if (existsSync(full) && readFileSync(full, 'utf8') === text) continue;
  write(file, text);
  written++;
}
const stale = GENERATED_ROOTS.flatMap(generatedOnDisk).filter((file) => !files.has(file));
for (const file of stale) rmSync(path.join(REPO, file));
const scaffolds = scaffoldFiles(REPO);
for (const [file, text] of scaffolds) write(file, text);
console.log(`Generated ${files.size} files (${written} changed), removed ${stale.length} stale, scaffolded ${scaffolds.size}${scaffolds.size ? `: ${[...scaffolds.keys()].join(', ')}` : ''}.`);
