// Choose a theme (LA-PLT-CMD03): the person keeps a theme from the Color theme command or the Appearance page.
import { appearanceRepository } from '../repository';
import { holdToRules } from '../rules';

export interface ChooseTheme { id: string }

/** Keeps the chosen theme; one that does not exist is refused. */
export function chooseTheme({ id }: ChooseTheme): void {
  const was = appearanceRepository.load();
  if (was.chosen === id) return;
  const next = { ...was, chosen: id };
  holdToRules(next);
  appearanceRepository.save(next);
}
