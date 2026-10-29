// The Product window's repository (LA-PLT-REPO04): the open windows in memory, as they live only while the shell
// runs, and the places and chrome in window-state.json and chrome.json in the shell's user data folder, read on the
// first load and rewritten when a save changes them.
import { parseSavedChrome, type SavedChrome } from '../chrome.ts';
import { readJson, writeJson } from '../store.ts';
import { parseWindowStates, type OpenWindow, type ProductWindows, type WindowStates } from './model.ts';

export class ProductWindowRepository {
  private readonly placesFile: () => string;
  private readonly chromeFile: () => string;
  private open = new Map<string, OpenWindow>();
  private stored: { places: WindowStates; chrome: SavedChrome } | null = null;
  constructor(files: { places: () => string; chrome: () => string }) {
    this.placesFile = files.places;
    this.chromeFile = files.chrome;
  }

  load(): ProductWindows {
    this.stored ??= { places: parseWindowStates(readJson(this.placesFile())), chrome: parseSavedChrome(readJson(this.chromeFile())) };
    return { open: new Map(this.open), places: this.stored.places, chrome: this.stored.chrome };
  }

  save(windows: ProductWindows): void {
    const was = this.stored;
    this.open = new Map(windows.open);
    this.stored = { places: windows.places, chrome: windows.chrome };
    if (JSON.stringify(was?.places) !== JSON.stringify(windows.places)) writeJson(this.placesFile(), windows.places);
    if (JSON.stringify(was?.chrome) !== JSON.stringify(windows.chrome)) writeJson(this.chromeFile(), windows.chrome);
  }
}
