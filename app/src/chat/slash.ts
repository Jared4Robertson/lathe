import type { ChatSkill } from './types';

// The "/" list (LA-PLT-UC22-R02): typing a slash at the start of the message box lists the skills and slash commands
// Claude Code would find for the folder, each with its one-line description, narrowed as the Owner types the name.

/** The name typed after a leading slash, or null when the draft is not just a slash and a name being typed. */
export function slashQuery(draft: string): string | null {
  const match = /^\/([\w:.-]*)$/.exec(draft);
  return match ? match[1].toLowerCase() : null;
}

/** The skills whose name starts with, or has a word starting with, the query: those starting with it first. */
export function matchSkills(skills: readonly ChatSkill[], query: string): ChatSkill[] {
  const q = query.toLowerCase();
  const starts = skills.filter((s) => s.name.toLowerCase().startsWith(q));
  const words = skills.filter((s) => !starts.includes(s) && s.name.toLowerCase().split(/[:-]/).some((w) => w.startsWith(q)));
  return [...starts, ...words];
}
