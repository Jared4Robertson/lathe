// lathe.config.json (LA-PLT-A10-REPO): it names the data folder, and a setting Lathe does not know is an error, never
// silently ignored.
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { loadConfig, loadWorkspace } from '../src/index.ts';
import { removeData, writeData } from './helpers.ts';

afterAll(removeData);

describe('product configuration', () => {
  it('LA-PLT-UC02-R02-T02 a config with an unknown setting is refused and names it', async () => {
    const root = writeData({});
    writeFileSync(path.join(root, 'lathe.config.json'), JSON.stringify({ data: 'data', diagrams: 'model' }));
    expect(() => loadConfig(root)).toThrow(/unknown setting "diagrams"/);
    await expect(loadWorkspace(root)).rejects.toThrow(/"diagrams"/);
    // The Markdown settings went with the Markdown: specs, checks and metaExtensions are unknown too.
    writeFileSync(path.join(root, 'lathe.config.json'), JSON.stringify({ specs: 'specs', checks: 'checks', metaExtensions: 'meta' }));
    expect(() => loadConfig(root)).toThrow(/unknown settings "specs", "checks", "metaExtensions"/);
  });

  it("LA-PLT-UC02-R02-T01 a product's lathe.config.json chooses the data folder", () => {
    const root = writeData({});
    writeFileSync(path.join(root, 'lathe.config.json'), JSON.stringify({ data: 'spec-data' }));
    expect(loadConfig(root).dataDir).toBe(path.join(root, 'spec-data'));
  });
});
