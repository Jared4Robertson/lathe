// lathe.config.json (LA-PLT-A10-REPO): it names the schema version and the data folder, and a setting Lathe does not
// know is an error, never silently ignored.
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { loadConfig, loadWorkspace, openStore, readConfig, SCHEMA_VERSION, SchemaVersionError, schemaVersionMessage } from '../src/index.ts';
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

  it('LA-PLT-UC17-R01-T01 a product whose data is for another schema version stops every load with what to do', async () => {
    const root = writeData({ product: [{ id: 'TL', title: 'Tool Library' }] });
    // No schema version is version 1, the first versioned schema.
    writeFileSync(path.join(root, 'lathe.config.json'), JSON.stringify({ data: 'data' }));
    expect(readConfig(root).schema).toBe(1);
    expect(loadConfig(root).schema).toBe(SCHEMA_VERSION);
    // Data for a newer schema needs a newer Lathe; every load says so, and nothing is read.
    writeFileSync(path.join(root, 'lathe.config.json'), JSON.stringify({ schema: SCHEMA_VERSION + 1, data: 'data' }));
    const newer = `This product's data is for schema ${SCHEMA_VERSION + 1}; this Lathe uses schema ${SCHEMA_VERSION}. It needs a newer Lathe: update @jaredrob/lathe.`;
    expect(() => loadConfig(root)).toThrow(SchemaVersionError);
    expect(() => loadConfig(root)).toThrow(newer);
    await expect(loadWorkspace(root)).rejects.toThrow(newer);
    await expect(openStore(root)).rejects.toThrow(newer);
    expect(readConfig(root).schema).toBe(SCHEMA_VERSION + 1);
    // Data for an older schema is upgraded.
    expect(schemaVersionMessage(1, 2)).toBe("This product's data is for schema 1; this Lathe uses schema 2. Run `npx lathe upgrade` to move it forward.");
    // A schema that is not a whole number from 1 is refused.
    for (const schema of [0, 1.5, '1']) {
      writeFileSync(path.join(root, 'lathe.config.json'), JSON.stringify({ schema }));
      expect(() => readConfig(root)).toThrow(/schema must be a whole number from 1/);
    }
  });
});
