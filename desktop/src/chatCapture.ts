// Capturing the stage for a message (LA-PLT-UC19-R17): the page names a rectangle of its window, the shell checks it and
// answers the pixels drawn there as a PNG (base64), so the Owner can send Claude the stage as it is. The page names only
// a rectangle; nothing outside the window can be read.
import type { WebContents } from 'electron';

/** A rectangle of the window in CSS pixels, checked: finite numbers, at least a pixel each way and no more than 8000. */
export function parseRect(input: unknown): { x: number; y: number; width: number; height: number } | null {
  if (!input || typeof input !== 'object') return null;
  const r = input as Record<string, unknown>;
  const { x, y, width, height } = r;
  if (![x, y, width, height].every((n) => typeof n === 'number' && Number.isFinite(n))) return null;
  if ((width as number) < 1 || (height as number) < 1 || (width as number) > 8000 || (height as number) > 8000) return null;
  return { x: Math.round(x as number), y: Math.round(y as number), width: Math.round(width as number), height: Math.round(height as number) };
}

/** The PNG of the window's rectangle as base64, or null when the rectangle is not one or nothing was drawn there. */
export async function captureStage(contents: Pick<WebContents, 'capturePage'>, rect: unknown): Promise<string | null> {
  const area = parseRect(rect);
  if (!area) return null;
  const image = await contents.capturePage(area);
  return image.isEmpty() ? null : image.toPNG().toString('base64');
}
