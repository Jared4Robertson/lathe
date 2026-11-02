// Who may write through the server: only the machine Lathe runs on. A server opened to the network (`lathe serve
// --network`, `npm --prefix app run dev:network`) lets other devices read, and refuses their writes, since the
// network has no sign-in (LA-PLT-UC23-R05). Every API answer to another device carries ACCESS_HEADER: READ_ONLY, so
// the app shows it is read-only there. The app imports this file, so it holds no Node code.

/** The header every API answer to another device carries. */
export const ACCESS_HEADER = 'x-lathe-access';

/** ACCESS_HEADER's value: this device reads and may not write. */
export const READ_ONLY = 'read-only';
