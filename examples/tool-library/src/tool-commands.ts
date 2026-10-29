// The Tool aggregate's command handlers, one per command.
// Spec: the command handlers TL-LEND-CMD02-H, CMD03-H and CMD04-H (examples/tool-library/data/).
// Each loads and saves the tool through its repository in one transaction, saves its event to the outbox in that
// transaction and runs the relay once it commits. The Tool aggregate enforces its own rules.
import type { Database } from './database.ts';
import type { Outbox } from './events.ts';
import { LendingError, parseName, parseNote, type Clock } from './model.ts';
import { Tool } from './tool.ts';
import type { ToolRepository } from './tool-repository.ts';

export interface AddToolInput {
  name?: unknown;
  description?: unknown;
}

/** What the Tool aggregate's command handlers need: its repository, the outbox, the clock and the transaction. */
export interface ToolCommandContext {
  db: Database;
  tools: ToolRepository;
  outbox: Outbox;
  now: Clock;
}

/** TL-LEND-CMD02-H: add a tool to the catalog. */
export function addTool(ctx: ToolCommandContext, input: AddToolInput): Tool {
  // TL-VO01-C01: a tool needs a name.
  // TL-PAT-LIBRARIAN-ACTION-R01: missing input is refused, naming it, before anything is saved.
  const name = parseName(input.name);
  if (!name) throw new LendingError(400, 'invalid_request', 'A tool needs a name.');
  const description = typeof input.description === 'string' ? input.description.trim() : '';
  const tool = ctx.db.transaction(() => {
    const saved = ctx.tools.add(Tool.add(name, description, ctx.now()));
    // TL-LEND-EV02
    ctx.outbox.save({ type: 'ToolAdded', toolId: saved.id, name: saved.name, description: saved.description, addedAt: saved.addedAt });
    return saved;
  });
  ctx.outbox.relay();
  return tool;
}

/**
 * TL-LEND-CMD03-H: mark a tool as needing repair, with a note (TL-VO04-C01). A tool that already needs repair is
 * refused by the aggregate (TL-LEND-INV02). An active loan on the tool is left as it is (TL-LEND-UC05-R03).
 * The librarian's endpoint and the event handler TL-LEND-PO01-H both invoke it.
 */
export function reportDamage(ctx: ToolCommandContext, toolId: number, note: unknown): Tool {
  // TL-PAT-LIBRARIAN-ACTION-R01: a missing note is refused before anything is saved.
  const text = parseNote(note);
  if (!text) throw new LendingError(400, 'invalid_request', 'Describe the damage in a note.');
  const tool = ctx.db.transaction(() => {
    const loaded = ctx.tools.get(toolId);
    const report = loaded.reportDamage(text, ctx.now());
    const saved = ctx.tools.save(loaded);
    // TL-LEND-EV03
    ctx.outbox.save({ type: 'DamageReported', toolId, note: report.note, reportedAt: report.reportedAt });
    return saved;
  });
  ctx.outbox.relay();
  return tool;
}

/** TL-LEND-CMD04-H: mark a damaged tool repaired, which returns it to lending; the aggregate refuses one that does not need repair (TL-LEND-SP04). */
export function markToolRepaired(ctx: ToolCommandContext, toolId: number): Tool {
  const tool = ctx.db.transaction(() => {
    const loaded = ctx.tools.get(toolId);
    loaded.markRepaired();
    const saved = ctx.tools.save(loaded);
    // TL-LEND-EV04
    ctx.outbox.save({ type: 'ToolRepaired', toolId, repairedAt: ctx.now().toISOString() });
    return saved;
  });
  ctx.outbox.relay();
  return tool;
}
