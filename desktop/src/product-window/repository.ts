// The Product window's repository (LA-PLT-REPO04): the open windows in memory, as they live only while the shell
// runs, and the places, chrome and chat modes in window-state.json, chrome.json and chat-modes.json in the
// shell's user data folder, read on the first load and rewritten when a save changes them.
import { parseSavedChrome, type SavedChrome } from '../chrome.ts';
import { readJson, writeJson } from '../store.ts';
import { parseChatModes, parseWindowStates, type ChatModes, type OpenWindow, type ProductWindows, type WindowStates } from './model.ts';

interface Stored { places: WindowStates; chrome: SavedChrome; modes: ChatModes }

export class ProductWindowRepository {
  private readonly files: { places: () => string; chrome: () => string; modes: () => string };
  private open = new Map<string, OpenWindow>();
  private stored: Stored | null = null;
  constructor(files: { places: () => string; chrome: () => string; modes: () => string }) {
    this.files = files;
  }

  load(): ProductWindows {
    this.stored ??= {
      places: parseWindowStates(readJson(this.files.places())),
      chrome: parseSavedChrome(readJson(this.files.chrome())),
      modes: parseChatModes(readJson(this.files.modes())),
    };
    return { open: new Map(this.open), ...this.stored };
  }

  save(windows: ProductWindows): void {
    const was = this.stored;
    this.open = new Map(windows.open);
    this.stored = { places: windows.places, chrome: windows.chrome, modes: windows.modes };
    if (JSON.stringify(was?.places) !== JSON.stringify(windows.places)) writeJson(this.files.places(), windows.places);
    if (JSON.stringify(was?.chrome) !== JSON.stringify(windows.chrome)) writeJson(this.files.chrome(), windows.chrome);
    if (JSON.stringify(was?.modes) !== JSON.stringify(windows.modes)) writeJson(this.files.modes(), windows.modes);
  }
}
