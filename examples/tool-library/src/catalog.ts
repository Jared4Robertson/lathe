// The Catalog read model: every tool with its status, as a borrower sees it, worked out on each request.
// Spec: the read model's table TL-LEND-RM01-TB (Catalog, kept in memory only), its projection TL-LEND-RM01-PJ, its
// reader TL-LEND-RM01-RD and the query handler TL-LEND-QRY01-H (examples/tool-library/data/).
// It reads the Tool and Loan aggregates through their repositories and stores nothing. The query handler reads the
// catalog only through its reader.
import type { LoanRepository } from './loan-repository.ts';
import type { Condition } from './model.ts';
import { needsRepair, type Tool } from './tool.ts';
import type { ToolRepository } from './tool-repository.ts';

/** TL-LEND-RM01's Status. */
export type ToolStatus = 'available' | 'on_loan' | 'needs_repair';

/** TL-LEND-RM01: one tool as the catalog lists it, its read model's fields. */
export interface CatalogEntry {
  id: number;
  name: string;
  description: string;
  condition: Condition;
  damageNote: string | null;
  addedAt: string;
  status: ToolStatus;
}

/** TL-LEND-RM01-TB: the catalog, kept in memory only, built on each request. */
export type Catalog = CatalogEntry[];

/**
 * TL-LEND-RM01-PJ: a tool's catalog entry, from the tool and its active loan. A tool on loan shows as on loan;
 * otherwise a tool that needs repair (TL-LEND-SP04) shows as needing repair.
 */
export function catalogEntry(loans: LoanRepository, tool: Tool): CatalogEntry {
  const onLoan = loans.activeForTool(tool.id) !== undefined;
  const status: ToolStatus = onLoan ? 'on_loan' : needsRepair(tool) ? 'needs_repair' : 'available';
  return {
    id: tool.id,
    name: tool.name,
    description: tool.description,
    condition: tool.condition,
    damageNote: tool.damage?.note ?? null,
    addedAt: tool.addedAt,
    status,
  };
}

/**
 * TL-LEND-RM01-RD: the one way the catalog's query handlers read it. The catalog is never stored, so the reader builds
 * its table with the projection on each read, from the Tool and Loan repositories.
 */
export class CatalogReader {
  private readonly tools: ToolRepository;
  private readonly loans: LoanRepository;

  constructor(ctx: { tools: ToolRepository; loans: LoanRepository }) {
    this.tools = ctx.tools;
    this.loans = ctx.loans;
  }

  /** Every tool's catalog entry, in tool ID order. */
  all(): Catalog {
    return this.tools.all().map((tool) => catalogEntry(this.loans, tool));
  }
}

/** TL-LEND-QRY01-H: the catalog, every tool in ID order with its status. */
export function listCatalog(catalog: CatalogReader): Catalog {
  return catalog.all();
}
