// Builds the chat's speech helper (native/speech/main.swift) to out/lathe-speech with the Swift compiler, on macOS
// only, and only when the source is newer than the build. Without Swift (or off macOS) it says so and builds nothing:
// the app then hides dictation, saying why (src/voice.ts).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(desktop, 'native', 'speech', 'main.swift');
const out = path.join(desktop, 'out', 'lathe-speech');

if (process.platform !== 'darwin') {
  console.log('[speech] Not macOS: no speech helper (dictation is macOS only).');
  process.exit(0);
}
if (existsSync(out) && statSync(out).mtimeMs >= statSync(source).mtimeMs) process.exit(0);
mkdirSync(path.dirname(out), { recursive: true });
const built = spawnSync('xcrun', ['swiftc', '-O', source, '-o', out], { stdio: 'inherit' });
if (built.error || built.status !== 0) {
  console.warn('[speech] The Swift compiler did not build the speech helper; dictation stays hidden. Install Xcode or its command line tools.');
  process.exit(0);
}
console.log(`[speech] Built ${path.relative(desktop, out)}`);
