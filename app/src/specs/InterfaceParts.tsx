import type { SpecRecord } from './data';

// Whether an interface's name says its kind, so a page naming the interface adds its kind only when it does not
// (a use case's flows, an interface's own page).

/** Whether an interface's name already says its kind (a CLI named CLI, an API named HTTP API). */
export const saysKind = (iface: SpecRecord) => iface.title.toLowerCase().includes(String(iface.row.kind ?? '').toLowerCase());
