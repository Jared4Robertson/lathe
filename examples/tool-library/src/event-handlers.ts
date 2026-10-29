// The Lending domain's policies, run by event handlers.
// Spec: the event handler TL-LEND-PO01-H (examples/tool-library/data/).
import type { Outbox, ToolReturned } from './events.ts';
import { LendingError } from './model.ts';
import { reportDamage, type ToolCommandContext } from './tool-commands.ts';

/** The damage note when a tool is returned needing repair with no note. */
export const RETURNED_NEEDING_REPAIR = 'Returned needing repair.';

/**
 * TL-LEND-PO01-H: hears Tool returned, relayed from the outbox, and, when the tool came back needing repair,
 * invokes Report damage through its command handler, in its own transaction, with the return note as the
 * damage note. A tool that already needs repair keeps its first damage report (TL-LEND-INV02): Report damage
 * refuses it, and the handler is done. So an event the relay hands it again after a failure changes nothing.
 * A return recorded as good invokes nothing, so it never clears damage.
 */
export function reportDamageOnReturn(ctx: ToolCommandContext): (event: ToolReturned) => void {
  return (event) => {
    if (event.condition !== 'needs_repair') return;
    try {
      reportDamage(ctx, event.toolId, event.note ?? RETURNED_NEEDING_REPAIR);
    } catch (err) {
      if (err instanceof LendingError && err.code === 'tool_already_damaged') return;
      throw err;
    }
  };
}

/** Subscribes every Lending policy's event handler to the outbox's relay. */
export function subscribePolicies(outbox: Outbox, ctx: ToolCommandContext): void {
  outbox.subscribe('ToolReturned', reportDamageOnReturn(ctx));
}
