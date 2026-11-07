/// <reference lib="webworker" />
import { readAnswer } from '../../record/query';
import type { SpaceReply, SpaceRequest } from './space-index';
import { spaceBuilder } from './space-builder';

// The space's index worker (space-index.ts): reads the record summaries and the folder tree off the page's main thread,
// works out the records, the graph's tree and each map's layout input, and answers the page with what changed.

declare const self: DedicatedWorkerGlobalScope;

const answer = spaceBuilder((address) => readAnswer(address));

self.onmessage = async (e: MessageEvent<SpaceRequest>) => {
  const reply: SpaceReply | null = await answer(e.data);
  if (reply) self.postMessage(reply);
};
