// The Tool aggregate: one physical item in the catalog, with its damage report while it needs repair.
// Spec: the aggregate TL-LEND-A2, its data models TL-LEND-EN02-DM and EN03-DM, its invariant TL-LEND-INV02
// and the predicate TL-LEND-SP04-PR (examples/tool-library/data/).
import { LendingError, type Condition } from './model.ts';

/** TL-LEND-EN03-DM: what is wrong with a tool while it needs repair, and when it was reported. */
export interface DamageReport {
  readonly note: string;
  readonly reportedAt: string;
}

/** A tool not saved yet, with no ID. */
export interface NewTool {
  readonly name: string;
  readonly description: string;
  readonly condition: Condition;
  readonly damage: DamageReport | null;
  readonly addedAt: string;
}

/** TL-LEND-SP04-PR: a tool needs repair when its condition is needs repair. */
export function needsRepair(tool: { readonly condition: Condition }): boolean {
  return tool.condition === 'needs_repair';
}

/** TL-LEND-EN02-DM: a tool, the Tool aggregate's root. Only its own methods change its condition. */
export class Tool {
  readonly id: number;
  readonly name: string;
  readonly description: string;
  readonly addedAt: string;
  #condition: Condition;
  #damage: DamageReport | null;

  constructor(id: number, fields: NewTool) {
    this.id = id;
    this.name = fields.name;
    this.description = fields.description;
    this.addedAt = fields.addedAt;
    this.#condition = fields.condition;
    this.#damage = fields.damage;
  }

  get condition(): Condition {
    return this.#condition;
  }

  /** The damage report while the tool needs repair; none once it is repaired. */
  get damage(): DamageReport | null {
    return this.#damage;
  }

  /** TL-LEND-CMD02, TL-LEND-UC02-R02: a new tool, from a name (TL-VO01) already parsed. It starts in good condition. */
  static add(name: string, description: string, addedAt: Date): NewTool {
    return { name, description, condition: 'good', damage: null, addedAt: addedAt.toISOString() };
  }

  /**
   * TL-LEND-CMD03: the tool needs repair, with the report's note (TL-VO04). TL-LEND-INV02: a tool that already
   * needs repair keeps its first report until it is marked repaired, so a second report is refused.
   */
  reportDamage(note: string, reportedAt: Date): DamageReport {
    if (needsRepair(this)) {
      throw new LendingError(409, 'tool_already_damaged', `Tool ${this.id} already needs repair; mark it repaired before reporting new damage.`);
    }
    this.#condition = 'needs_repair';
    this.#damage = { note, reportedAt: reportedAt.toISOString() };
    return this.#damage;
  }

  /** TL-LEND-CMD04: the tool is good again and its damage report is cleared. Only a tool that needs repair (TL-LEND-SP04). */
  markRepaired(): void {
    if (!needsRepair(this)) {
      throw new LendingError(409, 'tool_not_damaged', `Tool ${this.id} is not marked as needing repair.`);
    }
    this.#condition = 'good';
    this.#damage = null;
  }
}
