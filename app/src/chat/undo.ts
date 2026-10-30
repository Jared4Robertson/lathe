import type { WriteAnswer } from '../../../lathe/src/server/contract';
import type { RecordChange } from '../changes/changes';
import type { ChatItem } from './types';

// Undoing a turn (LA-PLT-UC21-R02): as a turn begins the server keeps the product's rows (POST /api/snapshot), and the
// Undo button asks it to roll the product back to them (POST /api/undo), through the aggregates' own commands, in
// reverse, in one write. Nothing is edited by hand and git is not touched; the server refuses, with every reason,
// what something since depends on.

/** The server's token for the product's rows now, or null when it cannot keep them. */
export async function takeSnapshot(product: string): Promise<string | null> {
  try {
    const res = await fetch('/api/snapshot', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ product_id: product }) });
    const body = (await res.json()) as { snapshot?: unknown };
    return res.ok && typeof body.snapshot === 'string' ? body.snapshot : null;
  } catch {
    return null;
  }
}

/** The records the turn's Lathe commands named, in the order Claude ran them (a failed command changed nothing). */
export function touchedInOrder(items: readonly ChatItem[]): string[] {
  const ids: string[] = [];
  for (const item of items) {
    if (item.kind !== 'tool' || item.status !== 'done' || !item.name.startsWith('mcp__plugin_lathe_lathe__')) continue;
    try {
      const id = (JSON.parse(item.input) as { id?: unknown }).id;
      if (typeof id === 'string') ids.push(id);
    } catch {
      // A clipped input names nothing here; the record is still undone, without its place in the order.
    }
  }
  return ids;
}

/** What undoing a turn came to: done, or refused with every reason. */
export type UndoOutcome = { ok: true } | { ok: false; reasons: string[] };

/** Rolls the product back to the snapshot. */
export async function undoTurn(snapshot: string, order: string[]): Promise<UndoOutcome> {
  try {
    const res = await fetch('/api/undo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ snapshot, order }) });
    const body = (await res.json()) as Partial<Extract<WriteAnswer, { ok: false }>> & { error?: string };
    if (res.ok) return { ok: true };
    if (body.problems?.length) return { ok: false, reasons: body.problems.map((p) => p.message) };
    return { ok: false, reasons: [body.error ?? `The server answered ${res.status}.`] };
  } catch (error) {
    return { ok: false, reasons: [error instanceof Error ? error.message : String(error)] };
  }
}

/** The records changed since the snapshot, each with its fields, parts and links; null when the server no longer keeps it. */
export async function turnChanges(snapshot: string): Promise<RecordChange[] | null> {
  try {
    const res = await fetch('/api/turn-changes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ snapshot }) });
    return res.ok ? ((await res.json()) as RecordChange[]) : null;
  } catch {
    return null;
  }
}
