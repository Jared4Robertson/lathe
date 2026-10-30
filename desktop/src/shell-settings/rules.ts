// The Shell settings' rules: the editor is one Lathe knows (editor-is-known, LA-PLT-INV32), and a custom editor has its
// command (custom-editor-has-command, LA-PLT-INV31).
import { holdTo, type RuleProblem } from '../rules.ts';
import { EDITORS, type Settings } from './model.ts';

export function shellSettingsProblems(settings: Settings): RuleProblem[] {
  const problems: RuleProblem[] = [];
  if (!(EDITORS as readonly string[]).includes(settings.editor)) problems.push({ rule: 'editor-is-known', message: `The editor "${settings.editor}" is not one Lathe knows.` });
  if (settings.editor === 'custom' && !settings.editorCommand?.trim()) problems.push({ rule: 'custom-editor-has-command', message: 'A custom editor needs its command in settings.json.' });
  return problems;
}

/** Refuses settings that break a rule, with every reason. */
export function holdToRules(settings: Settings): void {
  holdTo(shellSettingsProblems(settings));
}
