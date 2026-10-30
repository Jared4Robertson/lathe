// Reset a shortcut (LA-PLT-CMD57): the person gives a changed shortcut its default keys again.
import { withoutChange } from '../model';
import { keyBindingsRepository } from '../repository';
import { holdToRules } from '../rules';

export interface ResetShortcut { shortcut: string; mac: boolean }

/** Drops the shortcut's change; a default key another shortcut has taken since is refused, naming it. */
export function resetShortcut({ shortcut, mac }: ResetShortcut): void {
  const was = keyBindingsRepository.load();
  if (!was.changed.some((b) => b.shortcut === shortcut)) return;
  const next = withoutChange(was, shortcut);
  holdToRules(next, mac);
  keyBindingsRepository.save(next);
}
