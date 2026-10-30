// The skills and slash commands the chat's message box lists when the Owner types "/" (LA-PLT-UC22-R02): the ones
// Claude Code would find for this folder, read from its files so the list needs no process: the Owner's skills and
// commands, the folder's, those of the installed plugins, and the Lathe plugin every chat loads. Each is a name with
// a one-line description from its frontmatter. Nothing here runs a skill; the message goes to Claude Code as text.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

export interface ChatSkill {
  /** What the Owner types after the slash, such as "compact" or "lathe:check-and-fix". */
  name: string;
  /** One line of what it does; empty when its file has none. */
  description: string;
  kind: 'skill' | 'command';
}

/** The most characters of a description the list keeps. */
const MAX_DESCRIPTION = 160;

/** Claude Code's own commands that work in the chat without a dialog. */
const BUILT_IN: ChatSkill[] = [
  { name: 'compact', description: 'Summarize the conversation so far to free context.', kind: 'command' },
  { name: 'context', description: "Show how much of Claude's context the conversation uses.", kind: 'command' },
  { name: 'cost', description: 'Show what this session has cost so far.', kind: 'command' },
];

/** A file's frontmatter `name` and `description`, the description cut to its first sentence; none of it for a file without frontmatter. */
export function parseFrontmatter(text: string): { name: string | null; description: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  const fields = new Map<string, string>();
  if (match) {
    const lines = match[1].split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const m = /^([A-Za-z-]+):\s*(.*)$/.exec(lines[i]);
      if (!m) continue;
      let value = m[2].trim();
      // A folded or literal block (> or |) continues on the indented lines under it.
      if (/^[>|][+-]?$/.test(value)) {
        const block: string[] = [];
        while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) block.push(lines[++i].trim());
        value = block.join(' ');
      }
      fields.set(m[1], value.replace(/^(["'])(.*)\1$/, '$2'));
    }
  }
  const raw = (fields.get('description') ?? '').replace(/\s+/g, ' ').trim();
  const sentence = /^(.+?[.!?])(\s|$)/.exec(raw)?.[1] ?? raw;
  return { name: fields.get('name') ?? null, description: sentence.length > MAX_DESCRIPTION ? `${sentence.slice(0, MAX_DESCRIPTION - 1)}…` : sentence };
}

const read = (file: string): string | null => {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return null;
  }
};

const entries = (dir: string): string[] => {
  try {
    return readdirSync(dir).sort();
  } catch {
    return [];
  }
};

/** The skills in a folder of `<name>/SKILL.md`, each named `prefix` + its name. */
function skillsIn(dir: string, prefix: string): ChatSkill[] {
  const out: ChatSkill[] = [];
  for (const entry of entries(dir)) {
    const text = read(path.join(dir, entry, 'SKILL.md'));
    if (text === null) continue;
    const { name, description } = parseFrontmatter(text);
    out.push({ name: `${prefix}${name ?? entry}`, description, kind: 'skill' });
  }
  return out;
}

/** The commands in a folder of `<name>.md`, each named `prefix` + its file name. */
function commandsIn(dir: string, prefix: string): ChatSkill[] {
  const out: ChatSkill[] = [];
  for (const entry of entries(dir)) {
    if (!entry.endsWith('.md')) continue;
    const text = read(path.join(dir, entry));
    if (text === null) continue;
    out.push({ name: `${prefix}${entry.slice(0, -3)}`, description: parseFrontmatter(text).description, kind: 'command' });
  }
  return out;
}

/** The folders of the installed plugins, from Claude Code's own record of them. */
function installedPlugins(home: string): { name: string; dir: string }[] {
  const text = read(path.join(home, 'plugins', 'installed_plugins.json'));
  if (text === null) return [];
  try {
    const plugins = (JSON.parse(text) as { plugins?: Record<string, { installPath?: unknown }[]> }).plugins ?? {};
    return Object.entries(plugins).flatMap(([key, installs]) => {
      const install = installs?.[0]?.installPath;
      return typeof install === 'string' && existsSync(install) ? [{ name: key.split('@')[0], dir: install }] : [];
    });
  } catch {
    return [];
  }
}

export interface SkillSources {
  /** Claude Code's home folder (~/.claude). */
  home: string;
  /** The product folder the chat works in. */
  folder: string;
  /** The Lathe plugin the chat loads, which takes the place of an installed plugin of the same name. */
  latheDir: string;
}

/** Every skill and command the chat can run, by name, the first source winning a name: the folder's, the Owner's, Lathe's, the other plugins', Claude Code's own. */
export function listSkills({ home, folder, latheDir }: SkillSources): ChatSkill[] {
  const found: ChatSkill[] = [
    ...skillsIn(path.join(folder, '.claude', 'skills'), ''),
    ...commandsIn(path.join(folder, '.claude', 'commands'), ''),
    ...skillsIn(path.join(home, 'skills'), ''),
    ...commandsIn(path.join(home, 'commands'), ''),
    ...skillsIn(path.join(latheDir, 'skills'), 'lathe:'),
    ...commandsIn(path.join(latheDir, 'commands'), 'lathe:'),
    ...installedPlugins(home).filter((p) => p.name !== 'lathe').flatMap((p) => [...skillsIn(path.join(p.dir, 'skills'), `${p.name}:`), ...commandsIn(path.join(p.dir, 'commands'), `${p.name}:`)]),
    ...BUILT_IN,
  ];
  const seen = new Set<string>();
  return found.filter((s) => (seen.has(s.name) ? false : (seen.add(s.name), true))).sort((a, b) => a.name.localeCompare(b.name));
}
