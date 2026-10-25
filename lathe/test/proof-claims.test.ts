// Every proof a test claims is checked against its file, and an optional key replaces the ID rules.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadWorkspace, type Workspace } from '../src/index.ts';

const fixture = (name: string) => path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', name);

let ws: Workspace;
beforeAll(async () => {
  ws = await loadWorkspace(fixture('claims-proofs'));
});

const errorsAbout = (id: string) => ws.problems.filter((p) => p.severity === 'error' && p.record === id);
const missingProofs = (id: string) =>
  errorsAbout(id)
    .filter((p) => p.check === 'proof-not-in-file')
    .map((p) => p.message.match(/proves (\S+),/)?.[1]);

describe('a test file backs every proof the test claims', () => {
  it("LA-TRC-T36 A file that names the test's own ID accepts all its claims", () => {
    // CL-D-T01 proves CL-D-DR01 and CL-D-DR02; its file names only CL-D-T01.
    expect(errorsAbout('CL-D-T01')).toEqual([]);
  });

  it('LA-TRC-T37 A file that names every ID the test proves needs no test ID', () => {
    expect(errorsAbout('CL-D-T02')).toEqual([]);
  });

  it('LA-TRC-T38 A file that names only some of the IDs the test proves is an error for each one left out', () => {
    // CL-D-T03 proves CL-D-DR01 and CL-D-DR02; its file names only CL-D-DR01.
    expect(errorsAbout('CL-D-T03').map((p) => p.check)).toEqual(['proof-not-in-file']);
    expect(missingProofs('CL-D-T03')).toEqual(['CL-D-DR02']);
  });

  it('LA-TRC-T39 A file that names none of the IDs gives one error per proved ID, naming the test, the ID and the file', () => {
    expect(missingProofs('CL-D-T04')).toEqual(['CL-D-DR01', 'CL-D-DR02', 'CL-D-DR03']);
    const [first] = errorsAbout('CL-D-T04');
    expect(first).toMatchObject({ severity: 'error', check: 'proof-not-in-file', record: 'CL-D-T04' });
    expect(first.message).toContain('code/none.test.txt');
    expect(first.message).toContain('names neither CL-D-T04 nor CL-D-DR01');
    // The single older error is not also given.
    expect(errorsAbout('CL-D-T04').some((p) => p.check === 'test-file-missing-id')).toBe(false);
  });

  it('LA-TRC-T40 A test with a key is accepted when its file contains the key, though it names no ID', () => {
    expect(errorsAbout('CL-D-T05')).toEqual([]);
  });

  it("LA-TRC-T41 A test with a key whose file lacks the key is an error, even if the file names the test's ID", () => {
    const found = errorsAbout('CL-D-T06');
    expect(found).toEqual([
      { severity: 'error', check: 'test-file-missing-id', record: 'CL-D-T06', message: expect.stringContaining('"missing pattern proof"') },
    ]);
  });

  it('LA-TRC-T42 A proved ID is found in the file only as a whole ID', () => {
    // CL-D-T07 proves CL-D-DR04; its file names CL-D-DR040 and CL-D-DR04-R01.
    expect(missingProofs('CL-D-T07')).toEqual(['CL-D-DR04']);
  });

  it("LA-TRC-T43 A test that proves nothing and whose file lacks its ID is a test-file-missing-id error", () => {
    expect(errorsAbout('CL-D-T08')).toEqual([
      expect.objectContaining({ check: 'test-file-missing-id', message: expect.stringContaining('proves no record') }),
    ]);
  });

  it("LA-TRC-T44 A manual or planned test's file is not checked for its claims", () => {
    expect(errorsAbout('CL-D-T09')).toEqual([]);
    expect(errorsAbout('CL-D-T10')).toEqual([]);
  });
});
