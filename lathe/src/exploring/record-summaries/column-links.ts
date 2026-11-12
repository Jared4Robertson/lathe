// The column references the record summaries draw as links, beside the link tables' links, each with its words read
// from either end. Kept apart from the read model so the app reads the words without the projection's code.

/**
 * A use case's result (LA-STD-MODELING-R15): the graph joins a use case to its command or query, and the operation's
 * Links in name the use cases whose result it is.
 */
export const COLUMN_LINKS = [{ relation: 'result', table: 'use_case', column: 'result_id', forward_label: 'Result', reverse_label: 'Result of' }] as const;
