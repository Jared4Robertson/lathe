// The upgrade from end to end (LA-PLT-UC17-FL): a product set up with this Lathe meets a next Lathe whose schema
// renamed a column, made here as a copy of this package with one more schema version and its converter. The next
// Lathe refuses to load the product until `lathe upgrade` moves it forward, then loads it; this Lathe then says the
// product needs a newer Lathe.
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { PACKAGE_DIR, SCHEMA_VERSION } from '../../src/index.ts';

const temps: string[] = [];
const temp = (prefix: string) => {
  const dir = realpathSync(mkdtempSync(path.join(tmpdir(), prefix)));
  temps.push(dir);
  return dir;
};
afterAll(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

const run = (bin: string, root: string, ...args: string[]) => spawnSync(process.execPath, [bin, ...args, '--root', root], { encoding: 'utf8' });
const git = (root: string, ...args: string[]) => {
  const result = spawnSync('git', ['-c', 'user.name=Lathe Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', '-c', 'init.defaultBranch=main', ...args], { cwd: root, encoding: 'utf8' });
  expect(result.status, `git ${args.join(' ')}: ${result.stderr}`).toBe(0);
  return result.stdout;
};

// The next schema's converter, as Lathe would ship it in upgrades/: it moves the renamed column on the raw rows, gives
// each product its color, and leaves what it cannot judge as a to-do.
const CONVERTER = `
export default {
  files(data, notes) {
    data.write('product', data.read('product').map(({ notes: delivery, ...row }) => (delivery === undefined ? row : { ...row, delivery })));
    notes.changed('product.notes is now product.delivery');
    data.write('product', data.read('product').map((row) => {
      if (row.color) return row;
      notes.changed(row.id + ' takes the color #2E6A88');
      return { ...row, color: '#2E6A88' };
    }));
    for (const row of data.read('product')) if (row.delivery) notes.todo(row.id + ': check that its delivery note reads well on its own');
  },
};
`;

/** A copy of this Lathe one schema version on: product.notes renamed to product.delivery, with its converter. */
function nextLathe(): string {
  const next = path.join(temp('lathe-next-'), 'lathe');
  mkdirSync(next);
  for (const part of ['bin', 'src', 'schema', 'data', 'package.json']) cpSync(path.join(PACKAGE_DIR, part), path.join(next, part), { recursive: true });
  symlinkSync(path.join(PACKAGE_DIR, 'node_modules'), path.join(next, 'node_modules'));
  const migration = path.join(next, 'schema', '003-product.sql');
  const sql = readFileSync(migration, 'utf8');
  expect(sql).toContain('  notes VARCHAR\n');
  writeFileSync(migration, sql.replace('  notes VARCHAR\n', '  delivery VARCHAR\n').replace('COMMENT ON COLUMN product.notes IS', 'COMMENT ON COLUMN product.delivery IS'));
  const target = SCHEMA_VERSION + 1;
  writeFileSync(path.join(next, 'schema', 'version.json'), `${JSON.stringify({ schema: target })}\n`);
  mkdirSync(path.join(next, 'upgrades'));
  writeFileSync(path.join(next, 'upgrades', `${SCHEMA_VERSION}-to-${target}.ts`), CONVERTER);
  return next;
}

describe('moving a product to a new Lathe', () => {
  it('LA-PLT-UC17-FL-T the Owner inits a product, updates Lathe, upgrades the data and loads it', () => {
    const now = path.join(PACKAGE_DIR, 'bin', 'lathe.ts');
    const next = path.join(nextLathe(), 'bin', 'lathe.ts');
    const target = SCHEMA_VERSION + 1;

    // A product set up with this Lathe, with a note under the column the next schema renames, all committed.
    const root = temp('lathe-upgrade-');
    git(root, 'init', '-q');
    expect(run(now, root, 'init', '--name', 'Gadget Shop', '--prefix', 'GS').status).toBe(0);
    expect(run(now, root, 'product', 'change-product', '--id', 'GS', '--notes', 'Ships every Friday.').status).toBe(0);
    git(root, 'add', '.');
    git(root, 'commit', '-q', '-m', 'Set up Lathe');

    // S01: the next Lathe stops on the product's data, with what to do, and reads nothing.
    const refused = run(next, root, 'check');
    expect(refused.status).toBe(2);
    expect(refused.stderr.trim()).toBe(`This product's data is for schema ${SCHEMA_VERSION}; this Lathe uses schema ${target}. Run \`npx lathe upgrade\` to move it forward.`);
    expect(run(next, root, 'product', 'get-product', '--id', 'GS').stderr).toContain('Run `npx lathe upgrade` to move it forward.');

    // S02: with work not committed, the upgrade refuses; once it is clean, it converts and says what changed.
    writeFileSync(path.join(root, 'draft.md'), 'Not committed yet.\n');
    const dirty = run(next, root, 'upgrade');
    expect(dirty.status).toBe(2);
    expect(dirty.stderr).toContain('The git working tree has changes');
    rmSync(path.join(root, 'draft.md'));
    const upgraded = run(next, root, 'upgrade');
    expect(upgraded.stderr).toBe('');
    expect(upgraded.status).toBe(0);
    expect(upgraded.stdout).toBe(
      [
        `Upgraded ${root} from schema ${SCHEMA_VERSION} to schema ${target}.`,
        '',
        `${SCHEMA_VERSION}-to-${target}:`,
        '  product.notes is now product.delivery',
        '  GS takes the color #2E6A88',
        '',
        `lathe.config.json: schema ${SCHEMA_VERSION} -> ${target}`,
        '',
        'To do by hand (1):',
        `  - ${SCHEMA_VERSION}-to-${target}: GS: check that its delivery note reads well on its own`,
        '',
        'Next: run `lathe check`, review the changes with `git diff`, and commit them as one commit.',
        '',
      ].join('\n'),
    );
    expect(JSON.parse(readFileSync(path.join(root, 'lathe.config.json'), 'utf8'))).toEqual({ schema: target, data: 'data' });
    expect(git(root, 'status', '--porcelain').split('\n').filter(Boolean).sort()).toEqual([' M data/product.jsonl', ' M lathe.config.json']);

    // S03: the next Lathe loads it, with the note under its new name; the upgrade is one commit, and nothing is left to upgrade.
    const checked = run(next, root, 'check');
    expect(checked.status).toBe(0);
    expect(checked.stdout).toContain('0 errors, 0 warnings.');
    expect(readFileSync(path.join(root, 'data', 'product.jsonl'), 'utf8')).toContain('"delivery":"Ships every Friday."');
    git(root, 'commit', '-q', '-am', 'Upgrade to the next Lathe');
    expect(run(next, root, 'upgrade').stdout).toBe(`${root} is already at schema ${target}; there is nothing to upgrade.\n`);

    // This Lathe, older than the data now, says to update it.
    const older = run(now, root, 'check');
    expect(older.status).toBe(2);
    expect(older.stderr.trim()).toBe(`This product's data is for schema ${target}; this Lathe uses schema ${SCHEMA_VERSION}. It needs a newer Lathe: update @jaredrob/lathe.`);
  }, 120_000);
});
