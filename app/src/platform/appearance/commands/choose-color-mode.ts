// Choose a color mode (LA-PLT-CMD04): the person picks Light, Dark or System, which decides which of every theme's sets shows.
import type { ModeChoice } from '../../../theme/theme';
import { appearanceRepository } from '../repository';
import { holdToRules } from '../rules';

export interface ChooseColorMode { mode: ModeChoice }

/** Keeps the mode; the same mode changes nothing. */
export function chooseColorMode({ mode }: ChooseColorMode): void {
  const was = appearanceRepository.load();
  if (was.mode === mode) return;
  const next = { ...was, mode };
  holdToRules(next);
  appearanceRepository.save(next);
}
