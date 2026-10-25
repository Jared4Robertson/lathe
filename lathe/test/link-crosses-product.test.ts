// Each product is a space of its own (brief 82): a link stays inside its product, whatever the relation, and
// the link-crosses-product check reports one that leaves it. A citation in prose is not a link.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadWorkspace, type Workspace } from '../src/index.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const CHECK = 'link-crosses-product';

let ws: Workspace;
beforeAll(async () => {
  // cross-product: Alpha (AA) and Beta (BB). AA-ONE-DR01 involves an aggregate of Beta, AA-ONE-UC01 applies a rule
  // of Beta, and both cite Beta's records in prose. Beta's own links stay inside Beta.
  ws = await loadWorkspace(path.join(here, 'fixtures', 'cross-product'));
});

describe('the link-crosses-product check', () => {
  it('LA-CHK-T49 A link from a record of one product to a record of another is an error, whatever the relation; a citation in prose is not', () => {
    expect(ws.problems.filter((p) => p.check === CHECK)).toEqual([
      {
        severity: 'error', check: CHECK, record: 'AA-ONE-DR01',
        message: 'AA-ONE-DR01 involves BB-TWO-A1, a record of BB, not of its own product AA; a link stays inside its product, '
          + 'so remove it, or name BB-TWO-A1 in prose, where it is a plain citation.',
      },
      {
        severity: 'error', check: CHECK, record: 'AA-ONE-UC01',
        message: 'AA-ONE-UC01 applies BB-TWO-DR01, a record of BB, not of its own product AA; a link stays inside its product, '
          + 'so remove it, or name BB-TWO-DR01 in prose, where it is a plain citation.',
      },
    ]);
    // A link inside its product, and a citation of another product's record in prose, are not reported.
    expect(ws.problems.filter((p) => p.check === CHECK && p.record?.startsWith('BB'))).toEqual([]);
    expect(ws.records.find((r) => r.id === 'AA-ONE-UC01')?.body).toContain('BB-TWO-UC01');
    expect(ws.problems.some((p) => p.check === CHECK && p.message.includes('BB-TWO-UC01'))).toBe(false);
  });
});
