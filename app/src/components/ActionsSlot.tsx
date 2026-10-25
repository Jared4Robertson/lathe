import { createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

// A place in a heading's row where controls from further down can sit, such as a list's
// "Expand all". The heading owns the row; the list only says what goes in it. Outside a heading
// that offers a slot, the controls render where they are.

export const ActionsSlotContext = createContext<HTMLElement | null>(null);

/** Renders `children` in the nearest heading's actions slot, or in place (via `fallback`) when there is none. */
export function InActionsSlot({ children, fallback }: { children: ReactNode; fallback: (children: ReactNode) => ReactNode }) {
  const slot = useContext(ActionsSlotContext);
  return slot ? createPortal(children, slot) : <>{fallback(children)}</>;
}
