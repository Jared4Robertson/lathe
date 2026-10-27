// The desktop-only record actions (LA-AUT-UC15-R01): reveal a record's data file in Finder, open it in
// the editor, copy its ID, or a native menu of the three. The page names only a record ID; the main
// process checks the request (LA-PLT-DR38) and finds the file itself, among the folder's data files,
// so a page can never name a file of its own.
import type { MenuItemConstructorOptions } from 'electron';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/** A record ID, as the schema shapes them: capitals and digits in parts joined by hyphens. */
export const RECORD_ID = /^[A-Z][A-Z0-9]*(-[A-Z0-9]+)*$/;
const MAX_ID = 128;

export const RECORD_ACTIONS = ['reveal', 'open-in-editor', 'copy-id', 'menu'] as const;
export type RecordAction = (typeof RECORD_ACTIONS)[number];

export interface RecordRequest {
  action: RecordAction;
  id: string;
}

/** A page's request, when it is exactly { action, id } with a known action and a record ID; else null. */
export function parseRecordRequest(input: unknown): RecordRequest | null {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return null;
  const keys = Object.keys(input).sort();
  if (keys.length !== 2 || keys[0] !== 'action' || keys[1] !== 'id') return null;
  const { action, id } = input as Record<string, unknown>;
  if (typeof action !== 'string' || !(RECORD_ACTIONS as readonly string[]).includes(action)) return null;
  if (typeof id !== 'string' || id.length > MAX_ID || !RECORD_ID.test(id)) return null;
  return { action: action as RecordAction, id };
}

// A data file's line that holds the record starts with its id column: {"id":"<ID>", then a comma or the end.
function holds(text: string, id: string): boolean {
  const start = `{"id":${JSON.stringify(id)}`;
  return text.split('\n').some((line) => line.startsWith(start) && /^[,}]/.test(line.slice(start.length)));
}

/** The data file (<table>.jsonl in the data folder) that holds the record, or null. Only a kind's table starts its rows with id. */
export function findDataFile(dataDir: string, id: string): string | null {
  let files: string[];
  try {
    files = readdirSync(dataDir).filter((f) => f.endsWith('.jsonl')).sort();
  } catch {
    return null;
  }
  for (const name of files) {
    const file = path.join(dataDir, name);
    try {
      if (holds(readFileSync(file, 'utf8'), id)) return file;
    } catch {
      // A file that cannot be read holds no record to open.
    }
  }
  return null;
}

/** Finds records' data files, reading the folder again when a record is not where it was last seen. */
export class DataFiles {
  private readonly known = new Map<string, string>();
  private readonly dataDir: string;
  constructor(dataDir: string) {
    this.dataDir = dataDir;
  }

  find(id: string): string | null {
    const known = this.known.get(id);
    if (known && existsSync(known) && holds(readFileSync(known, 'utf8'), id)) return known;
    const found = findDataFile(this.dataDir, id);
    if (found) this.known.set(id, found);
    else this.known.delete(id);
    return found;
  }
}

/** What a platform calls revealing a file. */
export function revealLabel(platform: NodeJS.Platform): string {
  if (platform === 'darwin') return 'Reveal Data File in Finder';
  if (platform === 'win32') return 'Show Data File in File Explorer';
  return 'Show Data File in Folder';
}

export interface RecordMenuActions {
  reveal: () => void;
  openInEditor: () => void;
  copyId: () => void;
}

/** The native right-click menu of a record: reveal and open its file (when it has one), then copy its ID. */
export function recordMenuTemplate(id: string, hasFile: boolean, editorName: string, actions: RecordMenuActions, platform: NodeJS.Platform): MenuItemConstructorOptions[] {
  return [
    { label: revealLabel(platform), enabled: hasFile, click: actions.reveal },
    { label: `Open in ${editorName}`, enabled: hasFile, click: actions.openInEditor },
    { type: 'separator' },
    { label: `Copy ID “${id}”`, click: actions.copyId },
  ];
}
