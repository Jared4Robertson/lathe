import { useEffect, useState } from 'react';
import { askSpace } from '../../exploring/record-summaries/space-client';
import type { StageCounts } from '../../exploring/folder-tree/stage-counts';
import type { RecordIndex } from '../../exploring/record-summaries/record-index';

/** The space's records by stage, from the index's builder; undefined until it answers. Worked out again as the folder tree changes. */
export function useStageCounts(index: RecordIndex): StageCounts | undefined {
  const [counts, setCounts] = useState<StageCounts>();
  useEffect(() => {
    let current = true;
    void askSpace({ type: 'stage-counts', product: index.product }).then((reply) => {
      if (current && reply?.type === 'stage-counts' && reply.counts) setCounts(reply.counts);
    });
    return () => { current = false; };
  }, [index.product, index.folders]);
  return counts;
}
