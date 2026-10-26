// Groups (FORMAT.md section 23) and waivers by setting value (section 11). Fixture: groups-waivers, with
// structure.maxChildren 3. Pattern GW-PAT-ACT (settings scope audit) has R01 (no condition), R02 (applies when
// scope is not single), R03 (applies when scope is many), R04 (an unknown setting) and R05 (malformed). Its
// followers: GW-A (one use case, scope single), GW-B (single and Many), GW-C (the domain itself, scope single),
// GW-D (the domain itself, no settings) and GW-E (scope Not applicable).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadWorkspace, type Workspace } from '../src/index.ts';

const fixture = (name: string) => path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', name);
const ofCheck = (ws: Workspace, check: string) => ws.problems.filter((p) => p.check === check);
const owedIn = (ws: Workspace, domain: string) =>
  [...new Set(ws.coverage.find((c) => c.domain === domain)?.gaps.filter((g) => g.kind === 'pattern_rule').map((g) => g.id))].sort();
const rulesLine = (ws: Workspace, domain: string) =>
  ws.coverage.find((c) => c.domain === domain)?.obligations.find((o) => o.kind === 'pattern_rule');

let ws: Workspace;
beforeAll(async () => {
  ws = await loadWorkspace(fixture('groups-waivers'));
});

describe('groups', () => {
  it('LA-CHK-T53 too-many-children counts grouped requirements per group, groups compared in any case', () => {
    // GW-B-UC01 has 9 requirements: 1 ungrouped, 5 in Validation (one written "validation "), 3 in Paging.
    const found = ofCheck(ws, 'too-many-children').filter((p) => p.record === 'GW-B-UC01');
    expect(found.map((p) => p.message)).toEqual([
      expect.stringContaining('Use case GW-B-UC01 has 5 children of kind requirement in group Validation, more than the 3'),
    ]);
    // The pattern's 5 rules are in groups of 2, 1 and 2 (ungrouped), so none is too big.
    expect(ofCheck(ws, 'too-many-children').map((p) => p.record)).not.toContain('GW-PAT-ACT');
  });

  it('LA-CHK-T54 A group with one member is a lone-child warning on its parent, standard rules included', () => {
    expect(ofCheck(ws, 'lone-child').map((p) => [p.record, p.message])).toEqual([
      ['GW-B-V01', 'View GW-B-V01\'s group "Errors" has only one interaction requirement, GW-B-V01-IR01; merge it into a neighboring group, or give it more.'],
      ['GW-PAT-ACT', 'Pattern GW-PAT-ACT\'s group "Paging" has only one pattern rule, GW-PAT-ACT-R03; merge it into a neighboring group, or give it more.'],
      ['GW-STD-CODE', 'Standard GW-STD-CODE\'s group "Logging" has only one standard rule, GW-STD-CODE-R01; merge it into a neighboring group, or give it more.'],
    ]);
  });
});

describe('waivers by setting value', () => {
  it('LA-AUT-T136 An applies_when that is malformed or names a setting the pattern lacks is an error', () => {
    expect(ofCheck(ws, 'applies-when-unknown').map((p) => [p.severity, p.record, p.message])).toEqual([
      ['error', 'GW-PAT-ACT-R04', 'Pattern rule GW-PAT-ACT-R04 says it applies when "tone is red", but pattern GW-PAT-ACT has no setting "tone"; its settings are: scope audit.'],
      ['error', 'GW-PAT-ACT-R05', 'Pattern rule GW-PAT-ACT-R05 says it applies when "scope single", which is not written as "<setting> is <value>" or "<setting> is not <value>".'],
    ]);
    // Neither waives anything: both are owed wherever the pattern is followed.
    for (const domain of ['GW-A', 'GW-B', 'GW-C', 'GW-D', 'GW-E']) {
      expect(owedIn(ws, domain), domain).toEqual(expect.arrayContaining(['GW-PAT-ACT-R04', 'GW-PAT-ACT-R05']));
    }
  });

  it('LA-TRC-T118 A rule no follower meets is waived in that domain, neither owed nor proved', () => {
    // GW-A's only use case gives scope single: R02 (not single) and R03 (many) are waived there.
    expect(owedIn(ws, 'GW-A')).toEqual(['GW-PAT-ACT-R04', 'GW-PAT-ACT-R05']);
    expect(rulesLine(ws, 'GW-A')).toMatchObject({ total: 3, proved: 1 });
    // GW-A-T01 proves R01 and R02; R02's proof counts for nothing there, and no warning names R02 in GW-A.
    expect(ws.problems.filter((p) => p.record === 'GW-PAT-ACT-R02' && p.message.includes('GW-A'))).toEqual([]);
    // In GW-B one use case gives " Many ": it meets both, trimmed and in any letter case.
    expect(owedIn(ws, 'GW-B')).toEqual(['GW-PAT-ACT-R01', 'GW-PAT-ACT-R02', 'GW-PAT-ACT-R03', 'GW-PAT-ACT-R04', 'GW-PAT-ACT-R05']);
    expect(ofCheck(ws, 'unproved').filter((p) => p.record === 'GW-PAT-ACT-R02').map((p) => p.message)).toEqual([
      expect.stringContaining('is not proved in GW-B'),
    ]);
  });

  it('LA-TRC-T119 A domain that follows a pattern itself meets applies_when only through the settings it gives', () => {
    // GW-C gives scope single, GW-D gives no settings, GW-E's use case gives scope Not applicable: none meets R02 or R03.
    for (const domain of ['GW-C', 'GW-D', 'GW-E']) {
      expect(owedIn(ws, domain), domain).toEqual(['GW-PAT-ACT-R01', 'GW-PAT-ACT-R04', 'GW-PAT-ACT-R05']);
    }
  });
});
