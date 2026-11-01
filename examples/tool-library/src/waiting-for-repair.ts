// The Tools waiting for repair read model: each tool that needs repair, with what is wrong and since when, as the
// librarian works through them, worked out on each request.
// Spec: the read model's table TL-LEND-RM04-TB (ToolsWaitingForRepair, kept in memory only), its projection
// TL-LEND-RM04-PJ, its reader TL-LEND-RM04-RD and the query handler TL-LEND-QRY04-H (examples/tool-library/data/).
// It reads the Tool and Loan aggregates through their repositories and stores nothing. The query handler reads it only
// through its reader.
import type { LoanRepository } from './loan-repository.ts';
import { needsRepair, type Tool } from './tool.ts';
import type { ToolRepository } from './tool-repository.ts';

/** TL-LEND-RM04: one tool waiting for repair, its read model's fields. */
export interface ToolWaitingForRepair {
  id: number;
  name: string;
  damageNote: string;
  damageReportedAt: string;
  onLoan: boolean;
}

/** TL-LEND-RM04-TB: the tools waiting for repair, kept in memory only, built on each request. */
export type ToolsWaitingForRepair = ToolWaitingForRepair[];

/** TL-LEND-RM04-PJ: a tool's entry, from a tool that needs repair, with its damage report, and its active loan. */
function waitingForRepairEntry(loans: LoanRepository, tool: Tool & { damage: NonNullable<Tool['damage']> }): ToolWaitingForRepair {
  return {
    id: tool.id,
    name: tool.name,
    damageNote: tool.damage.note,
    damageReportedAt: tool.damage.reportedAt,
    onLoan: loans.activeForTool(tool.id) !== undefined,
  };
}

/**
 * TL-LEND-RM04-RD: the one way the read model's query handlers read it. It is never stored, so the reader builds its
 * table with the projection on each read, from the Tool and Loan repositories: every tool that needs repair
 * (TL-LEND-SP04), in tool ID order.
 */
export class ToolsWaitingForRepairReader {
  private readonly tools: ToolRepository;
  private readonly loans: LoanRepository;

  constructor(ctx: { tools: ToolRepository; loans: LoanRepository }) {
    this.tools = ctx.tools;
    this.loans = ctx.loans;
  }

  all(): ToolsWaitingForRepair {
    return this.tools
      .all()
      .filter((tool): tool is Tool & { damage: NonNullable<Tool['damage']> } => needsRepair(tool) && tool.damage !== null)
      .map((tool) => waitingForRepairEntry(this.loans, tool));
  }
}

/** TL-LEND-QRY04-H: the tools waiting for repair, the oldest damage report first, then in tool ID order. */
export function listToolsWaitingForRepair(waiting: ToolsWaitingForRepairReader): ToolsWaitingForRepair {
  return waiting.all().sort((a, b) => a.damageReportedAt.localeCompare(b.damageReportedAt) || a.id - b.id);
}
