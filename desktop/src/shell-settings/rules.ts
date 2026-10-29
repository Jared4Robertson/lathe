// The Shell settings' rules: the editor is one Lathe knows, and a custom editor has its command.
import { EDITORS, type Settings } from './model.ts';

export function shellSettingsProblems(settings: Settings): string[] {
  const problems: string[] = [];
  if (!(EDITORS as readonly string[]).includes(settings.editor)) problems.push(`The editor "${settings.editor}" is not one Lathe knows.`);
  if (settings.editor === 'custom' && !settings.editorCommand?.trim()) problems.push('A custom editor needs its command in settings.json.');
  return problems;
}

/** Refuses settings that break a rule, with every reason. */
export function holdToRules(settings: Settings): void {
  const problems = shellSettingsProblems(settings);
  if (problems.length) throw new Error(problems.join(' '));
}
