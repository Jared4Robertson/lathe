// Reset all shortcuts (LA-PLT-CMD58): the person gives every shortcut its default keys again, from the shortcuts sheet.
import { NO_BINDINGS } from '../model';
import { keyBindingsRepository } from '../repository';
import { holdToRules } from '../rules';

export interface ResetAllShortcuts { mac: boolean }

/** Drops every change; nothing changed saves nothing. */
export function resetAllShortcuts({ mac }: ResetAllShortcuts): void {
  if (keyBindingsRepository.load().changed.length === 0) return;
  holdToRules(NO_BINDINGS, mac);
  keyBindingsRepository.save(NO_BINDINGS);
}
