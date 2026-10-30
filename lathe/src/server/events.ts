// What the server announces when the data changes: Data files changed (LA-PLT-EV06), sent as `spec:changed` to every
// page (GET /api/events for `lathe serve`, Vite's channel in development). It names the tables whose rows changed and
// the read models whose answers may have changed, so a page reads again only those (LA-PLT-UC03-R02).

/** The name every page hears the change by. */
export const DATA_CHANGED = 'spec:changed';

/** One change to the data, as it is announced. */
export interface DataChange {
  /** The tables whose rows changed; empty when only the checks' run is new. */
  tables: string[];
  /**
   * The read models whose answers may have changed, each by its slice's name, the `<slice>` of the routes of its
   * queries (`/api/<slice>/<query>`); null when every read model may have (the data loaded afresh or was refused).
   */
  readModels: string[] | null;
}
