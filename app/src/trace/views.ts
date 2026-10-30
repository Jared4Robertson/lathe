// The Trace stage's views (LA-V98): All at once, the product's whole trace in five columns with its links; and Delivery,
// one row per use case from outcome to acceptance test suite (trace/delivery). Which one a place shows is the place's,
// kept in its view as its depth is (views/place.ts): each tab its own, switched by the toolbar's All at once | Delivery.

export type TraceViewName = 'all-at-once' | 'delivery';
export const TRACE_VIEWS: readonly { view: TraceViewName; label: string; tip: string }[] = [
  { view: 'all-at-once', label: 'All at once', tip: 'All at once: every outcome, use case, obligation, what builds it and what proves it, with their links' },
  { view: 'delivery', label: 'Delivery', tip: 'Delivery: one row per use case, from its outcome to its acceptance tests' },
];
export const DEFAULT_TRACE_VIEW: TraceViewName = 'all-at-once';
export const isTraceView = (v: unknown): v is TraceViewName => TRACE_VIEWS.some((t) => t.view === v);

/** How many rows a Trace list (the table's matrix, a phone's column) shows before Show more. */
export const TRACE_PAGE = 100;
