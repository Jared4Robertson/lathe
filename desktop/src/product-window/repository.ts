// The Product window's repository (LA-PLT-REPO04): the open windows in memory, as they live only while the shell
// runs, and the places and chrome in window-state.json and chrome.json in the shell's user data folder, read on the
// first load and rewritten when a save changes them.
import { parseSavedChrome, type SavedChrome } from '../chrome.ts';
import { readJson, writeJson } from '../store.ts';
import { parseWindowStates, type OpenWindow, type ProductWindows, type WindowStates } from './model.ts';

interface Stored { places: WindowStates; chrome: SavedChrome }

export class ProductWindowRepository {
  private readonly files: { places: () => string; chrome: () => string };
  private open = new Map<string, OpenWindow>();
  private stored: Stored | null = null;
  constructor(files: { places: () => string; chrome: () => string }) {
    this.files = files;
  }

  load(): ProductWindows {
    this.stored ??= {
      places: parseWindowStates(readJson(this.files.places())),
      chrome: parseSavedChrome(readJson(this.files.chrome())),
    };
    return { open: new Map(this.open), ...this.stored };
  }

  save(windows: ProductWindows): void {
    const was = this.stored;
    this.open = new Map(windows.open);
    this.stored = { places: windows.places, chrome: windows.chrome };
    if (JSON.stringify(was?.places) !== JSON.stringify(windows.places)) writeJson(this.files.places(), windows.places);
    if (JSON.stringify(was?.chrome) !== JSON.stringify(windows.chrome)) writeJson(this.files.chrome(), windows.chrome);
  }
}
