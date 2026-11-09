// What the canvas stages and TableScroll need from the browser that jsdom lacks: a size for each observed pane, and an element's offset size.

const observed = new Set<{ target: Element; observer: ResizeObserverStub }>();

class ResizeObserverStub {
  constructor(private callback: ResizeObserverCallback) {}
  observe(target: Element) {
    observed.add({ target, observer: this });
    this.fire(target);
  }
  fire(target: Element) {
    const contentRect = { x: 0, y: 0, width: 1000, height: 800, top: 0, left: 0, right: 1000, bottom: 800 } as DOMRectReadOnly;
    this.callback([{ target, contentRect } as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
  unobserve() {}
  disconnect() {
    for (const o of [...observed]) if (o.observer === this) observed.delete(o);
  }
}

/** Tells every observer of an element that it changed size (jsdom never does). */
export function fireResize(target: Element) {
  for (const o of [...observed]) if (o.target === target) o.observer.fire(target);
}

const g = globalThis as Record<string, unknown>;
g.ResizeObserver ??= ResizeObserverStub;

Object.defineProperties(HTMLElement.prototype, {
  offsetHeight: { configurable: true, get() { return parseFloat(this.style.height) || 1; } },
  offsetWidth: { configurable: true, get() { return parseFloat(this.style.width) || 1; } } });
