// What a stage tells the page about the node under the pointer or selected (FocusPage.tsx).

/**
 * The node a canvas has under the pointer or keyboard focus (`hover`, the spotlight)
 * and the one selected (`selected`: tapped once). It is a
 * small store, so a hover never redraws the canvas. The chat's app_focus tool reads the selection (LA-PLT-UC29-R01).
 */
interface Peek { hover: string | null; selected: string | null }
export interface PeekStore {
  get: () => Peek;
  set: (kind: keyof Peek, id: string | null) => void;
  clear: () => void;
  subscribe: (listener: () => void) => () => void;
}

export function createPeekStore(): PeekStore {
  let peek: Peek = { hover: null, selected: null };
  const listeners = new Set<() => void>();
  const emit = () => { for (const l of listeners) l(); };
  return {
    get: () => peek,
    set: (kind, id) => {
      if (peek[kind] === id) return;
      peek = { ...peek, [kind]: id };
      emit();
    },
    clear: () => {
      if (!peek.hover && !peek.selected) return;
      peek = { hover: null, selected: null };
      emit();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
