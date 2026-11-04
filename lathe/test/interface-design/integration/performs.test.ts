// An integration performs use cases of its product on its own (LA-IXD-UC27-R02): the Integration aggregate's Add and
// Change set the list, and the Use case, Integration and Trace read models read it.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { openStore } from '../../../src/index.ts';
import { ADD_INTEGRATION } from '../../../src/interface-design/integration/commands/add-integration.ts';
import { CHANGE_INTEGRATION } from '../../../src/interface-design/integration/commands/change-integration.ts';
import { GET_INTEGRATION } from '../../../src/interface-design/integration/queries.ts';
import { runCommand, runQuery } from '../../../src/platform/commands/run.ts';
import { StoreError } from '../../../src/platform/data/problems.ts';
import type { ReadView } from '../../../src/platform/data/rules.ts';
import { LIST_TRACED_USE_CASES } from '../../../src/traceability/trace/queries.ts';
import type { ProductTrace } from '../../../src/traceability/trace/read-model.ts';
import { GET_USE_CASE } from '../../../src/use-cases/use-case/queries.ts';
import { changing, complete, removeData, writeData } from '../../helpers.ts';

afterAll(removeData);

describe('performs', () => {
  it('LA-IXD-UC27-R02-T02 Add and Change an integration set the use cases it performs, and the use case reads them', async () => {
    // The complete product's interface made an API: it has no endpoint for the query of Borrow a tool's second step,
    // which exchanges with the mail integration, EX-INT01.
    const store = await openStore(writeData(changing(complete(), 'interface', () => true, { kind: 'API' })), { latheDataDir: null });
    try {
      const useCase = () => runQuery(store, GET_USE_CASE, { id: 'EX-LEND-UC01' }) as ReturnType<typeof GET_USE_CASE.run>;
      const reach = () => useCase().flows[0].through[0].paths.flatMap((p) => p.steps.map((s) => [s.id, s.reach, s.unreached]));
      expect(useCase().flows[0].performedBy).toEqual([]);
      expect(reach()).toEqual([['EX-LEND-UC01-FL-S01', ['EX-LEND-EP01'], false], ['EX-LEND-UC01-FL-S02', [], true]]);

      // Change sets the list, and writes only the links the integration starts.
      expect((await runCommand(store, CHANGE_INTEGRATION, { id: 'EX-INT01', performs: ['EX-LEND-UC01'] })).tables).toEqual(['performs']);
      expect((runQuery(store, GET_INTEGRATION, { id: 'EX-INT01' }) as ReturnType<typeof GET_INTEGRATION.run>).performs).toEqual(['EX-LEND-UC01']);
      expect(useCase().flows[0].performedBy).toEqual(['EX-INT01']);
      // The step that exchanges with the performing integration is carried out there.
      expect(reach()).toEqual([['EX-LEND-UC01-FL-S01', ['EX-LEND-EP01'], false], ['EX-LEND-UC01-FL-S02', ['EX-INT01'], false]]);

      // Add sets it too.
      const added = await runCommand(store, ADD_INTEGRATION, { id: 'EX-INT03', title: 'Build service', description: 'Publishes a release when a tag is pushed.', performs: ['EX-LEND-UC01'] });
      expect(added.tables).toEqual(['integration', 'performs']);
      expect(useCase().flows[0].performedBy).toEqual(['EX-INT01', 'EX-INT03']);
      // The trace shows them too: the flow names them, and the design status counts them.
      const checked: ReadView = { schema: store.schema, rows: (t) => store.rows(t), record: (id) => store.record(id), checked: { problems: [], coverage: [], chains: [] } };
      const traced = (runQuery(checked, LIST_TRACED_USE_CASES, { product_id: 'EX' }) as ProductTrace).rows.find((r) => r.useCase === 'EX-LEND-UC01')!;
      expect(traced.flow?.performedBy).toEqual(['EX-INT01', 'EX-INT03']);
      expect(traced.status.design.integrations).toBe(2);

      // A record that is not a use case is refused, and no file changes.
      const before = readFileSync(path.join(store.dataDir, 'performs.jsonl'), 'utf8');
      await expect(runCommand(store, CHANGE_INTEGRATION, { id: 'EX-INT01', performs: ['EX-LEND-CMD01'] })).rejects.toThrow(StoreError);
      expect(readFileSync(path.join(store.dataDir, 'performs.jsonl'), 'utf8')).toBe(before);
    } finally {
      await store.close();
    }
  });
});
