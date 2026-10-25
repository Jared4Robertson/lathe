// The desktop-only record actions (LA-AUT-UC16-R01): reveal a record's spec file in Finder, open it in
// the editor, copy its ID, or a native menu of the three. The page names only a record ID; the main
// process checks the request (LA-PLT-DR38) and finds the file itself, among the folder's spec files,
// so a page can never name a file of its own.
import type { MenuItemConstructorOptions } from 'electron';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

/** A record ID, as FORMAT section 2 defines it. */
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

/** The record ID in a spec file's front matter, if it has one. */
export function frontMatterId(text: string): string | null {
  const header = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const id = header?.[1].match(/^id:\s*(.+?)\s*$/m)?.[1].replace(/^(["'])(.*)\1$/, '$2');
  return id && RECORD_ID.test(id) ? id : null;
}

/** Every spec file under a folder by record ID (the first file wins, as the engine reports duplicates). */
export function indexSpecFiles(specsDir: string): Map<string, string> {
  const files = new Map<string, string>();
  const walk = (dir: string) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.md')) {
        let id: string | null = null;
        try {
          id = frontMatterId(readFileSync(full, 'utf8'));
        } catch {
          id = null;
        }
        if (id && !files.has(id)) files.set(id, full);
      }
    }
  };
  walk(specsDir);
  return files;
}

/**
 * Finds records' spec files, reading the folder again when a record is not where it was last seen
 * (it was added, moved or renamed since).
 */
export class SpecFiles {
  private index: Map<string, string> | null = null;
  private readonly specsDir: string;
  constructor(specsDir: string) {
    this.specsDir = specsDir;
  }

  find(id: string): string | null {
    const known = this.index?.get(id);
    if (known && existsSync(known) && frontMatterIdOf(known) === id) return known;
    this.index = indexSpecFiles(this.specsDir);
    return this.index.get(id) ?? null;
  }
}

function frontMatterIdOf(file: string) {
  try {
    return frontMatterId(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/** What a platform calls revealing a file. */
export function revealLabel(platform: NodeJS.Platform): string {
  if (platform === 'darwin') return 'Reveal Spec File in Finder';
  if (platform === 'win32') return 'Show Spec File in File Explorer';
  return 'Show Spec File in Folder';
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
