// Which body tokens are citations: record IDs, known ID prefixes and bare product or domain IDs (FORMAT.md section 12).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadConfig, loadWorkspace, type Workspace } from '../src/index.ts';
import { proseTokens } from '../src/parse.ts';

const fixture = (name: string) => path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', name);
const mentionsOf = (ws: Workspace, id: string) => ws.records.find((r) => r.id === id)?.mentions;
const unknownIds = (ws: Workspace) => ws.problems.filter((p) => p.check === 'unknown-id-in-prose').map((p) => p.message);

let configured: Workspace;
let records: Workspace;
beforeAll(async () => {
  configured = await loadWorkspace(fixture('citations-configured'));
  records = await loadWorkspace(fixture('citations-records'));
});

describe('citations by record ID and known prefix', () => {
  it('LA-AUT-T48 A token that is the ID of a record is a citation, whatever its prefix', () => {
    // STD-04 has no product or domain prefix and no idPrefixes entry names STD, but it is a record.
    expect(loadConfig(fixture('citations-records')).idPrefixes).toEqual([]);
    expect(mentionsOf(records, 'ACC-UC01')).toEqual(['STD-04']);
  });

  it("LA-AUT-T49 A token starting with a product's or domain's ID and '-' is a citation", () => {
    expect(mentionsOf(configured, 'ACC-UC01')?.slice(0, 1)).toEqual(['ACC-DR01']);
    expect(unknownIds(records)).toEqual(['ACC-UC01 mentions ACC-UC02, which does not exist.']);
  });

  it('LA-AUT-T50 A token starting with an idPrefixes entry and "-" is a citation', () => {
    expect(loadConfig(fixture('citations-configured')).idPrefixes).toEqual(['STD', 'SYS']);
    expect(unknownIds(configured)).toEqual([
      'ACC-UC01 mentions STD-99, which does not exist.',
      'ACC-UC01 mentions SYS-C01, which does not exist.',
    ]);
    // Without the config entry, the same tokens are not read.
    expect(unknownIds(records).join(' ')).not.toMatch(/STD-99|SYS-C01/);
  });

  it('LA-AUT-T51 A bare product or domain ID in plain prose is not a citation', () => {
    // The product body names Client and ACC in prose and cites only its two code spans.
    expect(mentionsOf(configured, 'Client')).toEqual(['ACC', 'Client-OPS']);
    expect(mentionsOf(records, 'ACC-UC01')).not.toContain('ACC');
  });

  it('LA-AUT-T52 A bare product or domain ID in a code span holding only that ID is a citation', () => {
    expect(mentionsOf(configured, 'ACC-UC01')).toEqual(['ACC-DR01', 'STD-04', 'ACC', 'Client', 'Client-OPS']);
  });

  it('LA-AUT-T53 Only a token with a known prefix that is not a record is an unknown-ID warning', () => {
    for (const ws of [configured, records]) {
      expect(unknownIds(ws).join(' ')).not.toMatch(/QQ-01|SYS-C99/);
    }
    expect(unknownIds(configured)).toHaveLength(2);
    expect(configured.problems.filter((p) => p.severity === 'error')).toEqual([]);
  });

  it('LA-AUT-T54 idPrefixes must be a list of ID prefixes', async () => {
    expect(() => loadConfig(fixture('citations-bad-config'))).toThrow(/idPrefixes must be a list of ID prefixes/);
    await expect(loadWorkspace(fixture('citations-bad-config'))).rejects.toThrow(/idPrefixes/);
  });

  it('LA-AUT-T55 The token reader tells an ID in a lone code span from one in prose', () => {
    expect(proseTokens('Client and `Client`, `TL-LEND`, TL-LEND, `Client x`.')).toEqual([
      { token: 'Client', inCode: false },
      { token: 'Client', inCode: true },
      { token: 'TL-LEND', inCode: true },
      { token: 'TL-LEND', inCode: false },
    ]);
  });
});
