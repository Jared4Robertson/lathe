import { it } from 'vitest';
import { indexOf } from '../fixtures/load';
import { repoData } from '../fixtures/repo';
import { spaceIndex } from '../../src/specs/data';
import { traceMap } from '../../src/trace/tree';
import { OUTSIDE } from '../../src/trace/top';
it('dump', async () => {
  const index = spaceIndex(indexOf(await repoData({ chains: true })), 'LA');
  const m = traceMap(index, 'LA');
  const kids = (k: string) => m.map.nodes.get(k)!.children;
  console.log(kids('LA').map((k) => `${k}: ${kids(k).length}`).join('\n'));
  console.log(kids(OUTSIDE).map((k) => `${k}: ${kids(k).length}`).join('\n'));
  console.log(m.map.nodes.size, m.counts);
}, 120000);
