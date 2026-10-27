// The Lending domain's policies, run by event handlers.
// Spec: the event handler TL-LEND-PO01-H (examples/tool-library/data/).
import type { EventDispatcher, ToolReturned } from './events.ts';
import type { ToolService } from './tool-service.ts';

/** The damage note when a tool is returned needing repair with no note. */
export const RETURNED_NEEDING_REPAIR = 'Returned needing repair.';

/**
 * TL-LEND-PO01-H: hears Tool returned and, when the tool came back needing repair, invokes Report damage
 * through its command handler, in its own transaction, with the return note as the damage note.
 * A return recorded as good invokes nothing, so it never clears damage (TL-LEND-INV02).
 */
export function reportDamageOnReturn(tools: ToolService): (event: ToolReturned) => void {
  return (event) => {
    if (event.condition !== 'needs_repair') return;
    tools.reportDamage(event.toolId, event.note ?? RETURNED_NEEDING_REPAIR);
  };
}

/** Subscribes every Lending policy's event handler to the dispatcher. */
export function subscribePolicies(events: EventDispatcher, tools: ToolService): void {
  events.subscribe('ToolReturned', reportDamageOnReturn(tools));
}
