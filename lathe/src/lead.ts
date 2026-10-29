// A record's lead text: the one column that opens its page, saying what the title, parent, links and facts cannot.
// Every kind has one of these columns or none (LA-STD-MODELING), and a kind's lead is always required: statement for
// something that must hold, goal for a use case, meaning for a term, field or setting, description for a thing that is.

/** The columns that may be a kind's lead; a kind's table has at most one of them, and it is required. */
export const LEAD_COLUMNS = ['statement', 'goal', 'meaning', 'description'] as const;

const LEADS: ReadonlySet<string> = new Set(LEAD_COLUMNS);

/** Whether a column's name makes it a lead column. */
export const isLeadColumn = (name: string): boolean => LEADS.has(name);
