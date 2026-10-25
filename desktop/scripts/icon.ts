// `npm --prefix desktop run icon`: renders build/icon.svg (the chuck from brand/chuck.svg on a
// macOS icon plate) to build/icon.png at 1024 px, from which electron-builder makes every size the
// app needs. Needs rsvg-convert (brew install librsvg). The PNG is committed, so packing does not.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const build = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'build');
execFileSync('rsvg-convert', ['-w', '1024', '-h', '1024', '-o', path.join(build, 'icon.png'), path.join(build, 'icon.svg')], { stdio: 'inherit' });
console.log(`Wrote ${path.join(build, 'icon.png')}`);
