// The Essential review read model's reader (LA-CHK-RM12-RD): the one way the Essential review query reaches the read
// model's storage. The query handler depends only on the EssentialReviewReader interface; the query runner injects the
// reader the query's definition makes (`reader`), so keeping the read model elsewhere is a new implementation of this
// interface and nothing more. Today's implementation reads the projection's table, kept in memory and built on each read.
import type { ReadView } from '../../platform/data/rules.ts';
import { essentialReviewTableFrom, type EssentialReview, type EssentialReviewTable } from './read-model.ts';

/** What the Essential review query reads, and all it reads. */
export interface EssentialReviewReader {
  /** The product's essential records by domain, or undefined when there is no such product. */
  reviewOf(product: string): EssentialReview | undefined;
}

/** The reader over the read model's table in memory. */
export class InMemoryEssentialReviewReader implements EssentialReviewReader {
  private readonly table: EssentialReviewTable;

  constructor(table: EssentialReviewTable) {
    this.table = table;
  }

  reviewOf(product: string): EssentialReview | undefined {
    return this.table.reviews.get(product);
  }
}

/** The reader the query runner gives the Essential review query: today's, over the projection's table built from the data. */
export const essentialReviewReader = (view: ReadView): EssentialReviewReader => new InMemoryEssentialReviewReader(essentialReviewTableFrom(view));
