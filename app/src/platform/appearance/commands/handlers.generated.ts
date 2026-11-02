// Generated from data/ by `npm run generate`. Do not edit.
// The appearance commands that set one setting, each named in the model's APPEARANCE_SETS: load the appearance, keep
// the input's value in its place, hold them to their rules and save; the same value again saves nothing.
import type { Appearance } from '../model';
import { appearanceRepository } from '../repository';
import { holdToRules } from '../rules';

export interface ChooseColorMode { mode: Appearance['mode'] }

/** Sets Light, Dark or System, which decides which of every theme's two color sets shows; System follows the device. */
export function chooseColorMode({ mode }: ChooseColorMode): void {
  const was = appearanceRepository.load();
  if (was.mode === mode) return;
  const next = { ...was, mode };
  holdToRules(next);
  appearanceRepository.save(next);
}

export interface ChooseTheme { id: Appearance['chosen'] }

/** Puts a theme in use across the whole app at once and keeps the choice; a chosen theme that no longer exists leaves Lathe in use. */
export function chooseTheme({ id }: ChooseTheme): void {
  const was = appearanceRepository.load();
  if (was.chosen === id) return;
  const next = { ...was, chosen: id };
  holdToRules(next);
  appearanceRepository.save(next);
}

export interface TurnScrollToZoomOnOrOff { on: Appearance['scrollToZoom'] }

/** Sets whether scroll zooms the Graph's, the ERD's and the Trace's cameras, Cmd or Ctrl with scroll panning them, or pans them as it does by default; for every tab and kept from one launch to the next. */
export function turnScrollToZoomOnOrOff({ on }: TurnScrollToZoomOnOrOff): void {
  const was = appearanceRepository.load();
  if (was.scrollToZoom === on) return;
  const next = { ...was, scrollToZoom: on };
  holdToRules(next);
  appearanceRepository.save(next);
}
