// The "/" list's skills and commands (LA-PLT-UC19-R14), read from the files Claude Code reads them from.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { listSkills, parseFrontmatter } from '../src/chatSkills.ts';

const roots: string[] = [];
afterEach(() => { for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true }); });

function write(root: string, file: string, text: string) {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  writeFileSync(path.join(root, file), text);
}

describe('LA-PLT-UC19-R14-T03 typing / lists the skills and commands of the Owner, the folder, Lathe and the plugins, with one-line descriptions', () => {
  it('reads a description from the frontmatter, cut to its first sentence', () => {
    expect(parseFrontmatter('---\nname: x\ndescription: Does a thing. Use it when asked.\n---\nBody')).toEqual({ name: 'x', description: 'Does a thing.' });
    expect(parseFrontmatter('---\ndescription: >\n  Folded over\n  two lines.\n---\n').description).toBe('Folded over two lines.');
    expect(parseFrontmatter('no frontmatter')).toEqual({ name: null, description: '' });
  });

  it('lists each source once, the folder\'s first, with Lathe\'s skills under lathe: and Claude Code\'s own commands last', () => {
    const base = mkdtempSync(path.join(os.tmpdir(), 'lathe-skills-'));
    roots.push(base);
    const home = path.join(base, 'home');
    const folder = path.join(base, 'folder');
    const lathe = path.join(base, 'plugin');
    write(home, 'skills/mine/SKILL.md', '---\nname: mine\ndescription: My own skill.\n---\n');
    write(home, 'commands/standup.md', '---\ndescription: Write the standup.\n---\n');
    write(folder, '.claude/skills/mine/SKILL.md', '---\nname: mine\ndescription: The folder\'s version.\n---\n');
    write(lathe, 'skills/check-and-fix/SKILL.md', '---\nname: check-and-fix\ndescription: Run lathe check.\n---\n');
    write(home, 'plugins/installed_plugins.json', JSON.stringify({ plugins: { 'other@market': [{ installPath: path.join(base, 'other') }] } }));
    write(path.join(base, 'other'), 'skills/draw/SKILL.md', '---\nname: draw\ndescription: Draw a thing.\n---\n');
    const skills = listSkills({ home, folder, latheDir: lathe });
    expect(skills.map((s) => s.name)).toEqual(['compact', 'context', 'cost', 'lathe:check-and-fix', 'mine', 'other:draw', 'standup']);
    expect(skills.find((s) => s.name === 'mine')?.description).toBe("The folder's version.");
    expect(skills.find((s) => s.name === 'standup')).toMatchObject({ kind: 'command', description: 'Write the standup.' });
  });

  it('lists only Claude Code\'s own commands for a folder with nothing of its own', () => {
    expect(listSkills({ home: '/nonexistent/home', folder: '/nonexistent/folder', latheDir: '/nonexistent/plugin' }).map((s) => s.name)).toEqual(['compact', 'context', 'cost']);
  });
});
