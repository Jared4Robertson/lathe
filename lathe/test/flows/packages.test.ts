// Accounting for the packages a product depends on, walked through the `lathe` command in process on a temporary product:
// a package a package.json lists is a gap until a technical record names it, only a technical record may name one,
// and a record that names a package no manifest lists is an error.
import { afterAll, describe, expect, it } from 'vitest';
import { add, gapsOf, LENDING, problemsOf, product, removeProducts } from './product.ts';

afterAll(removeProducts);

describe('Packages from the command line', () => {
  it('LA-TRC-UC19-FL03-T account for every package the product depends on', async () => {
    const tl = product();
    await tl.seed([
      ...LENDING,
      add('integration', { id: 'TL-INT01', title: 'Mail', system: 'The mail service' }),
      add('adapter', { id: 'TL-INT01-AD', title: 'Mailer', integration_id: 'TL-INT01', file: 'src/mail.ts' }),
    ]);
    tl.write('src/mail.ts', '// TL-INT01-AD\n');
    // S01: the Agent adds a dependency, and a dev dependency, to the package.json the code runs from.
    tl.write('package.json', `${JSON.stringify({ dependencies: { nodemailer: '^7.0.0' }, devDependencies: { vitest: '^4.0.0' } })}\n`);
    // S02: the check reports both as one gap on the product, naming each package and its manifest; a gap is not a problem.
    const open = await tl.check();
    expect(open.stdout).toContain('Product TL depends on 2 packages no record uses: nodemailer (package.json), vitest (package.json).');
    expect(gapsOf(await tl.workspace(), null)).toContain('package-not-accounted-for TL');
    expect(problemsOf(await tl.workspace(), 'package-not-in-manifest')).toEqual([]);
    // S03: the Agent names each package on the technical record that uses it; the store refuses one on a use case.
    expect(await tl.refused('add', 'package_use', '--record_id', 'TL-LEND-UC01', '--package', 'nodemailer')).toContain('TL-LEND-UC01 is a use case, not a technical record');
    await tl.run('add', 'package_use', '--record_id', 'TL-INT01-AD', '--package', 'nodemailer');
    await tl.run('add', 'package_use', '--record_id', 'TL-INT01-AD', '--package', 'vitest');
    expect(gapsOf(await tl.workspace(), null)).not.toContain('package-not-accounted-for TL');
    // S04: once a package leaves the manifest, the record that still names it is an error until the Agent removes it.
    tl.write('package.json', `${JSON.stringify({ dependencies: { nodemailer: '^7.0.0' } })}\n`);
    expect(problemsOf(await tl.workspace(), 'package-not-in-manifest')).toEqual(['TL-INT01-AD: Adapter TL-INT01-AD names package vitest, which no package.json of its product lists.']);
    await tl.run('remove', 'package_use', '--record_id', 'TL-INT01-AD', '--package', 'vitest');
    expect(problemsOf(await tl.workspace(), 'package-not-in-manifest')).toEqual([]);
  });
});
