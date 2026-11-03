// Builds the chat's speech helper (the Swift package in native/speech) to out/lathe-speech with SwiftPM, on macOS
// only, and only when its sources are newer than the build. The first build fetches the package's one dependency,
// FluidAudio, which runs the Parakeet speech model (the model itself is fetched by the helper when first used, never
// here). Without Swift (or off macOS) it says so and builds nothing: the app then hides dictation, saying why
// (src/voice.ts).
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, readdirSync, statSync, utimesSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = path.join(desktop, 'native', 'speech');
const out = path.join(desktop, 'out', 'lathe-speech');

if (process.platform !== 'darwin') {
  console.log('[speech] Not macOS: no speech helper (dictation is macOS only).');
  process.exit(0);
}

/** The package's sources: its manifest, its pinned versions and every Swift file. */
const sources = [path.join(pkg, 'Package.swift'), path.join(pkg, 'Package.resolved'), ...readdirSync(path.join(pkg, 'Sources', 'lathe-speech')).map((f) => path.join(pkg, 'Sources', 'lathe-speech', f))].filter((f) => existsSync(f));
const newest = Math.max(...sources.map((f) => statSync(f).mtimeMs));
if (existsSync(out) && statSync(out).mtimeMs >= newest) process.exit(0);

const swift = (...args: string[]) => spawnSync('xcrun', ['swift', 'build', '-c', 'release', '--package-path', pkg, ...args], { stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8' });
const built = swift('--product', 'lathe-speech');
if (built.error || built.status !== 0) {
  if (built.stdout) process.stdout.write(built.stdout);
  console.warn('[speech] SwiftPM did not build the speech helper; dictation stays hidden. Install Xcode 26 or its command line tools.');
  process.exit(0);
}
const bin = swift('--show-bin-path').stdout.trim();
mkdirSync(path.dirname(out), { recursive: true });
copyFileSync(path.join(bin, 'lathe-speech'), out);
chmodSync(out, 0o755);
const now = new Date();
utimesSync(out, now, now);
console.log(`[speech] Built ${path.relative(desktop, out)}`);
