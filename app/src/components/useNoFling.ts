import { useEffect, type RefObject } from 'react';

// A surface the app drags by hand (`touch-action: none`: a sheet's grab handle, a resize handle, a canvas) must hold
// on to the touch itself. Chromium still starts a fling from a flick there; the fling moves nothing, but it runs for
// most of a second, and a tap anywhere during it is taken as the tap that stops the fling and never becomes a click:
// the next button the Reader taps seems dead. Canceling the drag's touchmove stops the fling from starting. Pointer
// events carry on as before, and a press that does not move is still a tap. The listener is the element's own, not
// React's (passive) one, and only there, so the page's scrolling never waits on it.

/** Keeps the browser from flinging after a drag on `surface`, so the next tap on the page lands (LA-PAT-APP-UX-R07). */
export function useNoFling(surface: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = surface.current;
    if (!el) return;
    const hold = (e: TouchEvent) => { if (e.cancelable) e.preventDefault(); };
    el.addEventListener('touchmove', hold, { passive: false });
    return () => el.removeEventListener('touchmove', hold);
  }, [surface]);
}
