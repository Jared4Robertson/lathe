// Save a window's place (LA-PLT-CMD12): a window's size and position, and whether it is maximized or full screen,
// kept by folder for the next time it opens.
import { saveWindow, type SavedWindow } from '../model.ts';
import type { ProductWindowRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

export interface SaveWindowPlace {
  folder: string;
  place: SavedWindow;
}

export function saveWindowPlace(windows: ProductWindowRepository, input: SaveWindowPlace): void {
  const now = windows.load();
  const next = { ...now, places: saveWindow(now.places, input.folder, input.place) };
  holdToRules(next);
  windows.save(next);
}
