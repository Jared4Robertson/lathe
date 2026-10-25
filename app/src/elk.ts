import type { ELK, ElkNode } from 'elkjs/lib/elk-api';

// ELK, the layout engine the graph, the Model view and the diagrams share (LA-PAT-APP-UX-R11). In a
// browser it runs in a web worker, so laying out a picture never blocks the main thread: the page
// keeps painting, and a re-center's frames stay short. Where there are no workers (the tests, in
// jsdom) it runs the bundled copy on the main thread instead. One ELK serves every caller, and it
// loads only when something is first laid out, so the wiki's first load leaves it out.

let shared: Promise<ELK> | null = null;

function makeElk(): Promise<ELK> {
  if (typeof Worker !== 'undefined') {
    return Promise.all([import('elkjs/lib/elk-api.js'), import('elkjs/lib/elk-worker.min.js?url')]).then(
      ([api, worker]) => new api.default({ workerUrl: worker.default }),
    );
  }
  return import('elkjs/lib/elk.bundled.js').then((m) => new m.default());
}

/** Lays out an ELK graph, in the worker when there is one. */
export async function elkLayout(graph: ElkNode): Promise<ElkNode> {
  shared ??= makeElk();
  try {
    return await (await shared).layout(graph);
  } catch (error) {
    // A worker that failed to start is not tried again: the next layout makes a new ELK.
    shared = null;
    throw error;
  }
}
