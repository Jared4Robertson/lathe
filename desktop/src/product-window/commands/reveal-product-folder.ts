// Reveal a product folder (LA-PLT-CMD46): the error page's Reveal in Finder (or its name elsewhere) shows the
// window's own folder in the system's file manager.
import type { ProductWindowRepository } from '../repository.ts';

export interface RevealProductFolder {
  folder: string;
}

export function revealProductFolder(windows: ProductWindowRepository, input: RevealProductFolder, reveal: (folder: string) => void): void {
  if (windows.load().open.has(input.folder)) reveal(input.folder);
}
