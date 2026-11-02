import { useSyncExternalStore } from 'react';
import { ACCESS_HEADER, READ_ONLY } from '../../../lathe/src/server/access';

// Whether this device may change the spec. A server opened to the network lets other devices read and refuses their
// writes (LA-PLT-UC23-R05); each read's answer says which this device is (lathe/src/server/access.ts), the first one
// being the meta model's. A read-only device gets no writer (App.tsx), so no editor shows its actions, and the shell
// shows the read-only note (LA-V61-R55).

let readOnly = false;
const listeners = new Set<() => void>();

/** Notes what an API answer says about this device. */
export function noteAccess(res: Response): void {
  const now = res.headers.get(ACCESS_HEADER) === READ_ONLY;
  if (now === readOnly) return;
  readOnly = now;
  for (const listener of listeners) listener();
}

/** True when this device only reads: the server refuses its writes. */
export function useReadOnly(): boolean {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    () => readOnly,
  );
}
