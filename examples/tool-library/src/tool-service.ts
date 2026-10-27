// The catalog: adds tools, lists them with their status, and records damage and repair.
// Spec: the command handlers TL-LEND-CMD02-H, CMD03-H and CMD04-H and the query handler TL-LEND-QRY01-H
// (examples/tool-library/data/).
// Each command handler publishes its event once its write has committed.
import type { EventDispatcher } from './events.ts';
import { LendingError, needsRepair, parseName, parseNote, toolStatus, type CatalogEntry, type Clock, type Tool } from './model.ts';
import type { Store } from './store.ts';

export interface AddToolInput {
  name?: unknown;
  description?: unknown;
}

export class ToolService {
  private readonly store: Store;
  private readonly now: Clock;
  private readonly events: EventDispatcher;

  constructor(store: Store, now: Clock, events: EventDispatcher) {
    this.store = store;
    this.now = now;
    this.events = events;
  }

  /** TL-LEND-CMD02-H: add a tool to the catalog. */
  add(input: AddToolInput): CatalogEntry {
    // TL-VO01-C01: a tool needs a name.
    // TL-PAT-LIBRARIAN-ACTION-R01: missing input is refused, naming it, before anything is saved.
    const name = parseName(input.name);
    if (!name) throw new LendingError(400, 'invalid_request', 'A tool needs a name.');
    const description = typeof input.description === 'string' ? input.description.trim() : '';
    // TL-LEND-UC02-R02: a new tool starts in good condition, so it is available.
    const tool = this.store.insertTool(name, description, this.now().toISOString());
    // TL-LEND-EV02
    this.events.publish({ type: 'ToolAdded', toolId: tool.id, name: tool.name, description: tool.description, addedAt: tool.addedAt });
    return this.entry(tool);
  }

  /** TL-LEND-QRY01-H: the catalog, with each tool's status. */
  list(): CatalogEntry[] {
    return this.store.listTools().map((t) => this.entry(t));
  }

  get(id: number): CatalogEntry {
    return this.entry(this.require(id));
  }

  /**
   * TL-LEND-CMD03-H: mark a tool as needing repair, with a note (TL-VO04-C01).
   * An active loan on the tool is left as it is (TL-LEND-UC05-R03). The librarian's endpoint and
   * the event handler TL-LEND-PO01-H both invoke it.
   */
  reportDamage(id: number, note: unknown): CatalogEntry {
    // TL-PAT-LIBRARIAN-ACTION-R01: a missing note is refused before anything is saved.
    const text = parseNote(note);
    if (!text) throw new LendingError(400, 'invalid_request', 'Describe the damage in a note.');
    const reportedAt = this.now().toISOString();
    const tool = this.store.transaction(() => {
      this.require(id);
      return this.store.setToolCondition(id, 'needs_repair', text);
    });
    // TL-LEND-EV03
    this.events.publish({ type: 'DamageReported', toolId: id, note: text, reportedAt });
    return this.entry(tool);
  }

  /** TL-LEND-CMD04-H: mark a damaged tool repaired, which returns it to lending; it must need repair (TL-LEND-SP04). */
  markRepaired(id: number): CatalogEntry {
    const repairedAt = this.now().toISOString();
    const tool = this.store.transaction(() => {
      if (!needsRepair(this.require(id))) {
        throw new LendingError(409, 'tool_not_damaged', `Tool ${id} is not marked as needing repair.`);
      }
      return this.store.setToolCondition(id, 'good', null);
    });
    // TL-LEND-EV04
    this.events.publish({ type: 'ToolRepaired', toolId: id, repairedAt });
    return this.entry(tool);
  }

  private require(id: number): Tool {
    const tool = this.store.findTool(id);
    if (!tool) throw new LendingError(404, 'tool_not_found', `There is no tool ${id}.`);
    return tool;
  }

  private entry(tool: Tool): CatalogEntry {
    return { ...tool, status: toolStatus(tool, this.store.activeLoanForTool(tool.id) !== undefined) };
  }
}
