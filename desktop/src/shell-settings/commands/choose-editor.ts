// Choose an editor (LA-PLT-CMD40): File › Open Records In keeps the editor "Open in editor" uses.
import type { Editor } from '../model.ts';
import type { ShellSettingsRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

export interface ChooseEditor {
  editor: Editor;
}

export function chooseEditor(settings: ShellSettingsRepository, input: ChooseEditor): void {
  const next = { ...settings.load(), editor: input.editor };
  holdToRules(next);
  settings.save(next);
}
