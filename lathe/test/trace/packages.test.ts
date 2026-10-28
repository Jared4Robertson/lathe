// Packages: every package a product's package.json files list is named by a technical record of it (package_use), a
// record names only a package a manifest lists, and only a technical record names one. Each starts from the complete
// product, which names no package and has no package.json, so it gives no problem and no gap.
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { loadWorkspace } from '../../src/index.ts';
import { adding, complete, gaps, loadData, ofCheck, refusals, removeData, writeData } from '../helpers.ts';

afterAll(removeData);

const manifest = (sections: Record<string, Record<string, string>>) => `${JSON.stringify(sections, null, 2)}\n`;

/** The complete product with the packages named on its adapter (EX-INT01-AD). */
const naming = (...packages: string[]) => adding(complete(), { package_use: packages.map((p) => ({ record_id: 'EX-INT01-AD', package: p })) });

const packageGaps = (ws: Awaited<ReturnType<typeof loadData>>) => ws.coverage.flatMap((c) => c.gaps).filter((g) => g.missing === 'package-not-accounted-for');

describe('packages', () => {
  it('LA-TRC-UC19-R01-T01 a package a manifest lists that no record names is one gap on the product, until a record names it', async () => {
    const files = {
      'package.json': manifest({ dependencies: { nodemailer: '^7.0.0' }, devDependencies: { vitest: '^4.0.0' } }),
      'server/package.json': manifest({ dependencies: { nodemailer: '^7.0.0' }, peerDependencies: { '@scope/tool': '^1.0.0' }, optionalDependencies: { fsevents: '^2.0.0' } }),
    };
    const open = await loadData(naming('fsevents'), { files });
    expect(packageGaps(open)).toEqual([{
      id: 'EX',
      kind: 'product',
      missing: 'package-not-accounted-for',
      message: 'Product EX depends on 3 packages no record uses: @scope/tool (server/package.json), nodemailer (package.json, server/package.json), vitest (package.json).',
    }]);
    // A dev dependency is accounted for as a runtime one is, and one record may name several packages.
    const closed = await loadData(naming('fsevents', 'nodemailer', 'vitest', '@scope/tool'), { files });
    expect(gaps(closed)).toEqual([]);
    expect(closed.problems).toEqual([]);
  });

  it('LA-TRC-UC19-R02-T01 a record that names a package no manifest lists is an error naming the record and the package', async () => {
    const ws = await loadData(naming('nodemailer', 'left-pad'), { files: { 'package.json': manifest({ dependencies: { nodemailer: '^7.0.0' } }) } });
    expect(ofCheck(ws, 'package-not-in-manifest')).toEqual([
      { severity: 'error', check: 'package-not-in-manifest', record: 'EX-INT01-AD', message: 'Adapter EX-INT01-AD names package left-pad, which no package.json of its product lists.' },
    ]);
    // With no package.json at all, every package a record names is reported.
    expect(ofCheck(await loadData(naming('nodemailer')), 'package-not-in-manifest').map((p) => p.record)).toEqual(['EX-INT01-AD']);
  });

  it("LA-TRC-UC19-R03-T01 only a technical record names a package: the store refuses it on any other, and takes a product's own technical kind", async () => {
    const refused = await refusals(adding(complete(), { package_use: [{ record_id: 'EX-LEND-UC01', package: 'nodemailer' }] }));
    expect(refused).toEqual([expect.objectContaining({ rule: 'package-use-technical', table: 'package_use', message: expect.stringContaining('EX-LEND-UC01 is a use case, not a technical record') })]);
    // A name that is not a package name is refused by the table's own CHECK.
    expect(await refusals(naming('Not A Package'))).toEqual([expect.objectContaining({ table: 'package_use' })]);
    const tooling = adding(complete(), {
      product_kind: [{ name: 'tooling', product_id: 'EX', label: 'Tooling', description: 'A dev script or config file.', parent_kind: 'domain', stage: 'technical-specification', obligation: false }],
      product_kind_field: [{ kind: 'tooling', position: 1, name: 'file', type: 'text', required: true, description: 'The config file.' }],
    });
    const withRecord = adding(tooling, {
      tooling: [{ id: 'EX-LEND-TOOL01', title: 'Test runner', domain_id: 'EX-LEND', file: 'vitest.config.ts' }],
      package_use: [{ record_id: 'EX-LEND-TOOL01', package: 'vitest' }],
    });
    // Written as data files and loaded, as a product's repo is: the tooling record's own table comes from its declaration.
    const root = writeData(withRecord);
    writeFileSync(path.join(root, 'package.json'), manifest({ devDependencies: { vitest: '^4.0.0' } }));
    const ws = await loadWorkspace(root);
    expect(packageGaps(ws)).toEqual([]);
    expect(ofCheck(ws, 'package-not-in-manifest')).toEqual([]);
    expect(ofCheck(ws, 'data-refused')).toEqual([]);
  });

  it('LA-TRC-UC19-R04-T01 the manifests are those of the folders lathe.config.json lists, or else of the root and each folder directly under it', async () => {
    const files = {
      'package.json': manifest({ dependencies: { a: '1' } }),
      'app/package.json': manifest({ dependencies: { b: '1' } }),
      'app/nested/package.json': manifest({ dependencies: { c: '1' } }),
      'node_modules/d/package.json': manifest({ dependencies: { d: '1' } }),
      '.cache/package.json': manifest({ dependencies: { e: '1' } }),
    };
    const found = await loadData(complete(), { files });
    expect(packageGaps(found).map((g) => g.message)).toEqual(['Product EX depends on 2 packages no record uses: a (package.json), b (app/package.json).']);
    const listed = await loadData(complete(), { files: { ...files, 'lathe.config.json': '{ "schema": 1, "packages": ["app/nested"] }\n' } });
    expect(packageGaps(listed).map((g) => g.message)).toEqual(['Product EX depends on a package no record uses: c (app/nested/package.json).']);
    // A listed folder with no package.json stops the load, as any config mistake does.
    await expect(loadData(complete(), { files: { ...files, 'lathe.config.json': '{ "schema": 1, "packages": ["server"] }\n' } })).rejects.toThrow('lathe.config.json: packages names server, which holds no package.json.');
    await expect(loadData(complete(), { files: { 'lathe.config.json': '{ "schema": 1, "packages": ["../elsewhere"] }\n' } })).rejects.toThrow(/packages must list folders inside the product root.*\.\.\/elsewhere is outside it/);
  });
});
