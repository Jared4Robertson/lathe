// ID order: the one way Lathe sorts record IDs, with the numbers inside them compared by value (UC2 before UC10). One
// collator, made once: `localeCompare` with options builds one on every comparison, which costs seconds when a large
// product's records are sorted (LA-PLT-UC03-R05).
const collator = new Intl.Collator('en', { numeric: true });

/** Two IDs (or any texts) in ID order. */
export const compareIds = (a: string, b: string): number => collator.compare(a, b);

/** Two records in the order of their IDs. */
export const byRecordId = (a: { id: string }, b: { id: string }): number => collator.compare(a.id, b.id);
