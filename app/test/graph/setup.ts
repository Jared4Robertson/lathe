// What React Flow needs from the browser that jsdom lacks (see React Flow's testing guide).

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

class DOMMatrixReadOnlyStub {
  m22: number;
  constructor(transform?: string) {
    const scale = transform?.match(/scale\(([0-9.]+)\)/)?.[1];
    this.m22 = scale !== undefined ? Number(scale) : 1;
  }
}

const g = globalThis as Record<string, unknown>;
g.ResizeObserver ??= ResizeObserverStub;
g.DOMMatrixReadOnly ??= DOMMatrixReadOnlyStub;

Object.defineProperties(HTMLElement.prototype, {
  offsetHeight: { configurable: true, get() { return parseFloat(this.style.height) || 1; } },
  offsetWidth: { configurable: true, get() { return parseFloat(this.style.width) || 1; } } });
(SVGElement.prototype as unknown as { getBBox: () => DOMRect }).getBBox = () => ({ x: 0, y: 0, width: 0, height: 0 }) as DOMRect;
