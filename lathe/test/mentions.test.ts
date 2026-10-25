// IDs cited in record bodies: SpecRecord.mentions and the unknown-id-in-prose warning (FORMAT.md section 12).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadWorkspace, type Workspace } from '../src/index.ts';
import { idTokensInProse } from '../src/parse.ts';

const fixture = (name: string) => path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', name);
const mentionsOf = (id: string) => ws.records.find((r) => r.id === id)?.mentions;

let ws: Workspace;
beforeAll(async () => {
  ws = await loadWorkspace(fixture('mentions-prose'));
});

describe('mentions', () => {
  it('LA-AUT-T33 A record mentions the existing IDs its body cites, in order of first mention', () => {
    // A bare product or domain ID in plain prose (NX, MX-D) is not a citation (FORMAT.md section 12).
    expect(mentionsOf('MX-D-UC01')).toEqual(['MX-D-UC02', 'MX-D-UC01-R01', 'MX-D-UC03']);
    expect(mentionsOf('MX')).toEqual([]);
    expect(mentionsOf('MX-D-UC02')).toEqual(['MX-D-UC01-R01', 'MX-D-UC01']);
    // A body that cites nothing has no mentions.
    expect(mentionsOf('MX-D')).toEqual([]);
  });

  it('LA-AUT-T121 A record never mentions another product\'s records: products are separate spaces', () => {
    expect(mentionsOf('MX-D-UC04')).toEqual(['MX-D-UC02']);
    // The other product's ID is still a known record, so it is no unknown ID either.
    expect(ws.problems.filter((p) => p.record === 'MX-D-UC04' && p.check === 'unknown-id-in-prose')).toEqual([]);
  });

  it('LA-CHK-T12 IDs in fenced code blocks and in code spans with other text are not citations, but a code span holding one lone ID is', () => {
    const cited = ws.records.flatMap((r) => r.mentions);
    for (const id of ['MX-D-UC94', 'MX-D-UC95', 'MX-D-UC96', 'MX-D-UC97', 'MX-D-UC98']) expect(cited).not.toContain(id);
    expect(ws.problems.filter((p) => p.message.includes('UC9'))).toEqual([]);
    expect(idTokensInProse('A `B-1 x` C\n```js\nD-2\n```\nE ``F-3 ` x`` G\n~~~\nH-4\n```\n~~~\nI-5')).toEqual(['A', 'C', 'E', 'G', 'I-5']);
    // A code span with one ID and nothing else is how writers format IDs, so it is a citation.
    expect(idTokensInProse('See `TL-LEND-DR05` and ` TL-LEND-UC01 `, not `TL-LEND-DR06 x`.')).toEqual(['TL-LEND-DR05', 'TL-LEND-UC01']);
    // A fence left open runs to the end of the body.
    expect(idTokensInProse('A-1\n````\nB-2\n```\nC-3')).toEqual(['A-1']);
  });

  it('LA-AUT-T34 A token without a workspace product prefix, or not a whole ID, is ignored', () => {
    const cited = ws.records.flatMap((r) => r.mentions);
    expect(cited).not.toContain('ZZ-D-UC01');
    expect(cited).not.toContain('MXY-D-UC01');
    expect(ws.problems.filter((p) => /ZZ|MXY/.test(p.message))).toEqual([]);
    expect(idTokensInProse('TL-LEND-DR05a tl-LEND-DR05 TL-LEND-DR05_x')).toEqual([]);
    // A longer ID is read whole, so its tail is never taken for a shorter ID.
    expect(idTokensInProse('X-TL-LEND-DR05')).toEqual(['X-TL-LEND-DR05']);
    expect(idTokensInProse('(TL-LEND-DR05), [TL-LEND-DR05-R01](x.md) TL-LEND-DR05.')).toEqual([
      'TL-LEND-DR05',
      'TL-LEND-DR05-R01',
      'TL-LEND-DR05',
    ]);
  });

  it('LA-AUT-T35 Mentions hold no repeats and never the record itself', () => {
    for (const r of ws.records) {
      expect(new Set(r.mentions).size, r.id).toBe(r.mentions.length);
      expect(r.mentions, r.id).not.toContain(r.id);
    }
    expect(mentionsOf('MX-D-UC01-R01')).toEqual(['MX-D-UC02', 'MX-D-T01']);
  });

  it('LA-AUT-T36 A cited ID with a known prefix that is not a record is one warning', () => {
    expect(ws.problems.filter((p) => p.check === 'unknown-id-in-prose')).toEqual([
      {
        severity: 'warning',
        check: 'unknown-id-in-prose',
        record: 'MX-D-UC01',
        message: 'MX-D-UC01 mentions MX-D-DR99, which does not exist.',
      },
    ]);
  });

  it('LA-AUT-T37 Mentions are not links', () => {
    expect(ws.links).toEqual([]);
    expect(ws.problems.filter((p) => p.severity === 'error')).toEqual([]);
    const gaps = ws.problems.filter((p) => p.record === 'MX-D-UC01-R01').map((p) => p.check).sort();
    expect(gaps).toEqual(['unproved', 'unsatisfied']);
    const requirements = ws.coverage.find((c) => c.domain === 'MX-D')?.obligations.find((o) => o.kind === 'requirement');
    expect(requirements).toMatchObject({ total: 1, designed: 0, proved: 0 });
  });
});
