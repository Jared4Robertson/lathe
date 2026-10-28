// Which Lathe a product window runs (src/servers.ts latheFor): the product's own installed Lathe when it has one, the
// app's bundled copy otherwise, and the About window says which.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { aboutModel } from '../src/launch.ts';
import { latheFor, latheLabel } from '../src/servers.ts';

const temp = mkdtempSync(path.join(os.tmpdir(), 'lathe-desktop-servers-'));
afterAll(() => rmSync(temp, { recursive: true, force: true }));

/** A built Lathe package at dir with the given version; returns its serve() module. */
function builtLathe(dir: string, version: string): string {
  const serve = path.join(dir, 'dist', 'src', 'server', 'serve.js');
  mkdirSync(path.dirname(serve), { recursive: true });
  writeFileSync(serve, 'export function serve() {}\n');
  writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: '@jaredrob/lathe', version }));
  return serve;
}

describe('the Lathe a product opens with', () => {
  it("LA-PLT-UC11-R09-T01 is the product's own installed Lathe when it has one, else the bundled copy, and About says which", () => {
    const bundled = builtLathe(path.join(temp, 'app', 'lathe'), '1.0.0');
    const plain = path.join(temp, 'plain');
    mkdirSync(plain);
    const withOwn = path.join(temp, 'with-own');
    const own = builtLathe(path.join(withOwn, 'node_modules', '@jaredrob', 'lathe'), '1.4.2');

    const fallback = latheFor(plain, bundled);
    expect(fallback).toEqual({ modulePath: bundled, source: 'bundled', version: '1.0.0' });
    expect(latheLabel(fallback)).toBe('bundled Lathe 1.0.0');
    const chosen = latheFor(withOwn, bundled);
    expect(chosen).toEqual({ modulePath: own, source: 'product', version: '1.4.2' });
    expect(latheLabel(chosen)).toBe('its own Lathe 1.4.2');

    // An installed package that is not built is not used.
    const unbuilt = path.join(temp, 'unbuilt');
    mkdirSync(path.join(unbuilt, 'node_modules', '@jaredrob', 'lathe'), { recursive: true });
    expect(latheFor(unbuilt, bundled).source).toBe('bundled');

    const colors = { background: '#DDE3E6', foreground: '#1D2830' };
    const versions = { app: '0.1.0', engine: '1.0.0', electron: '45.0.0', chrome: '140', node: '24' };
    expect(aboutModel(versions, colors, { lathe: latheLabel(chosen) }).versions).toContainEqual({ label: 'Opened with', value: 'its own Lathe 1.4.2' });
    expect(aboutModel(versions, colors).versions.map((v) => v.label)).not.toContain('Opened with');
  });
});
