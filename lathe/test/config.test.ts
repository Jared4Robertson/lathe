// lathe.config.json (LA-AUT-C07): a setting Lathe does not know is an error, never silently ignored.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadConfig, loadWorkspace } from '../src/index.ts';

const fixture = (name: string) => path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', name);

describe('product configuration', () => {
  it('LA-PLT-T08 a config with an unknown setting is refused and names it', async () => {
    expect(() => loadConfig(fixture('config-unknown-key'))).toThrow(/unknown setting "diagrams"/);
    await expect(loadWorkspace(fixture('config-unknown-key'))).rejects.toThrow(/"diagrams"/);
  });
});
