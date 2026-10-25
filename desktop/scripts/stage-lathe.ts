// Before packing: puts the built Lathe package and its production dependencies (DuckDB, yaml) in
// build/stage/node_modules, which electron-builder copies into the app's resources. The shell's
// main process imports serve() from there (servers.ts). Run `npm --prefix lathe run build` first.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lathe = path.join(desktop, '..', 'lathe');
const stage = path.join(desktop, 'build', 'stage');

if (!existsSync(path.join(lathe, 'dist', 'app', 'index.html'))) {
  console.error('Lathe is not built. Run: npm --prefix lathe run build');
  process.exit(1);
}

rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });
execFileSync('npm', ['pack', lathe, '--ignore-scripts', '--pack-destination', stage], { stdio: 'inherit' });
const tarball = readdirSync(stage).find((f) => f.endsWith('.tgz'));
if (!tarball) throw new Error('npm pack made no tarball.');
writeFileSync(path.join(stage, 'package.json'), JSON.stringify({ name: 'lathe-desktop-stage', private: true, dependencies: { '@jaredrob/lathe': `file:./${tarball}` } }, null, 2));
execFileSync('npm', ['install', '--omit=dev', '--no-package-lock', '--no-audit', '--no-fund'], { cwd: stage, stdio: 'inherit' });
console.log(`Staged Lathe in ${path.join(stage, 'node_modules')}`);
