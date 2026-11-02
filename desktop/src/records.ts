// The desktop-only record actions (LA-PAT-RECORD-DATA-FILE-R01): reveal a record's data file in Finder, open it in the editor,
// copy its ID, or a native menu of the three, each on its own channel (product-window/commands/). The page names only a
// record ID; the main process checks the request (LA-PAT-SHELL-ACTIONS-R01) and asks the window's engine which data file
// holds the record (its Record's data file read, LA-PRD-QRY05), so a page can never name a file of its own.
import type { MenuItemConstructorOptions } from 'electron';
import path from 'node:path';

/** A record ID, as the schema shapes them: capitals and digits in parts joined by hyphens. */
export const RECORD_ID = /^[A-Z][A-Z0-9]*(-[A-Z0-9]+)*$/;
const MAX_ID = 128;

/** A page's request, when it is exactly { id } with an ID in the record ID format; else null. Each action has its own channel. */
export function parseRecordId(input: unknown): string | null {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return null;
  const keys = Object.keys(input);
  if (keys.length !== 1 || keys[0] !== 'id') return null;
  const { id } = input as Record<string, unknown>;
  if (typeof id !== 'string' || id.length > MAX_ID || !RECORD_ID.test(id)) return null;
  return id;
}

/** The engine's route of the Record's data file read (lathe/src/product/record-data-file/queries.ts). */
export const RECORD_DATA_FILE_ROUTE = '/api/record-data-file/find-record-data-file';

/**
 * The data file that holds the record, as the engine at `serverUrl` answers it: a full path to a .jsonl file, or null
 * when no record has the ID, the engine has no such read (an older Lathe) or does not answer.
 */
export async function recordDataFile(serverUrl: string, id: string, get: typeof fetch = fetch): Promise<string | null> {
  try {
    const res = await get(`${serverUrl}${RECORD_DATA_FILE_ROUTE}?id=${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const file = ((await res.json()) as { file?: unknown } | null)?.file;
    return typeof file === 'string' && path.isAbsolute(file) && file.endsWith('.jsonl') ? file : null;
  } catch {
    return null;
  }
}

/** What a platform calls revealing a file. */
export function revealLabel(platform: NodeJS.Platform): string {
  if (platform === 'darwin') return 'Reveal Data File in Finder';
  if (platform === 'win32') return 'Show Data File in File Explorer';
  return 'Show Data File in Folder';
}

export interface RecordMenuActions {
  /** Attaches the record to the chat's message (LA-PLT-UC22-R01). */
  askClaude: () => void;
  /** Opens the record in a new tab of the app's (LA-V103-R02). */
  openInNewTab: () => void;
  reveal: () => void;
  openInEditor: () => void;
  copyId: () => void;
}

/** The native right-click menu of a record: open it in a new tab, ask Claude about it, reveal and open its file (when it has one), then copy its ID. */
export function recordMenuTemplate(id: string, hasFile: boolean, editorName: string, actions: RecordMenuActions, platform: NodeJS.Platform): MenuItemConstructorOptions[] {
  return [
    { label: 'Open in New Tab', click: actions.openInNewTab },
    { label: 'Ask Claude About This', click: actions.askClaude },
    { type: 'separator' },
    { label: revealLabel(platform), enabled: hasFile, click: actions.reveal },
    { label: `Open in ${editorName}`, enabled: hasFile, click: actions.openInEditor },
    { type: 'separator' },
    { label: `Copy ID “${id}”`, click: actions.copyId },
  ];
}
