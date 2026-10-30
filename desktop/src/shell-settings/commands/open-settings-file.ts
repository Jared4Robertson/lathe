// Open the settings file (LA-PLT-CMD41): File › Open Records In › Edit Settings File… writes settings.json when it
// is missing, with an empty editor command to fill in, and opens it.
import type { ShellSettingsRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

export function openSettingsFile(settings: ShellSettingsRepository, open: (file: string) => void): void {
  if (!settings.stored()) {
    const now = settings.load();
    holdToRules(now);
    settings.save(now);
  }
  open(settings.location());
}
