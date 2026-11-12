// The use cases that keep a record of the specification through one aggregate command, each with the one requirement
// that the command refuses what breaks a rule and leaves every data file as it was. A command given nothing is refused
// with the field it needs, on a product that holds a record of every kind, and no data file changes. The commands' fuller
// flows run in authoring.test.ts and storage.test.ts and in the stability specs; the rules each aggregate holds are
// proved in the aggregate's own tests.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { openStore } from '../../src/index.ts';
import { run } from '../helpers.ts';
import { everyKind, removeData, writeData } from '../store/fixture.ts';

afterAll(removeData);

/** Every data file of the product, by name, as text. */
const files = (root: string) => Object.fromEntries(readdirSync(path.join(root, 'data')).map((f) => [f, readFileSync(path.join(root, 'data', f), 'utf8')]));

describe('Keeping a record of the specification through its aggregate\'s command', () => {
  it.each<[string, string]>([
    ['LA-IXD-UC30-R01-T01', 'view remove-view'],
    ['LA-IXD-UC32-R01-T01', 'endpoint move-endpoint'],
    ['LA-IXD-UC33-R01-T01', 'integration add-adapter'],
    ['LA-IXD-UC34-R01-T01', 'integration remove-integration'],
    ['LA-IXD-UC35-R01-T01', 'ui-component change-ui-component'],
    ['LA-IXD-UC36-R01-T01', 'ui-component remove-ui-component'],
    ['LA-MOD-UC35-R01-T01', 'domain change-domain'],
    ['LA-MOD-UC37-R01-T01', 'domain move-term'],
    ['LA-MOD-UC38-R01-T01', 'domain move-repository'],
    ['LA-MOD-UC39-R01-T01', 'domain move-domain-service'],
    ['LA-MOD-UC43-R01-T01', 'command add-command-handler'],
    ['LA-MOD-UC45-R01-T01', 'specification add-specification-test'],
    ['LA-MOD-UC48-R01-T01', 'read-model add-query'],
    ['LA-MOD-UC49-R01-T01', 'read-model add-projection'],
    ['LA-MOD-UC50-R01-T01', 'read-model add-reader'],
    ['LA-MOD-UC52-R01-T01', 'value-object add-constraint'],
    ['LA-MOD-UC55-R01-T01', 'domain-event change-domain-event'],
    ['LA-MOD-UC56-R01-T01', 'storage-requirement add-storage-requirement-test'],
    ['LA-MOD-UC58-R01-T01', 'storage-requirement change-storage-requirement-test'],
    ['LA-MOD-UC59-R01-T01', 'storage-requirement remove-storage-requirement-test'],
    ['LA-MOD-UC60-R01-T01', 'storage-requirement remove-storage-requirement'],
    ['LA-PRD-UC42-R01-T01', 'interface change-interface'],
    ['LA-PRD-UC44-R01-T01', 'journey move-journey-step'],
    ['LA-PRD-UC45-R01-T01', 'journey change-journey-step'],
    ['LA-PRD-UC48-R01-T01', 'extension-record change-extension-record'],
    ['LA-PRD-UC49-R01-T01', 'extension-record remove-extension-record'],
    ['LA-PRD-UC51-R01-T01', 'product move-question'],
    ['LA-PRD-UC52-R01-T01', 'product remove-question'],
    ['LA-TEC-UC34-R01-T01', 'standard change-standard-rule'],
    ['LA-TEC-UC35-R01-T01', 'table change-table'],
    ['LA-TEC-UC36-R01-T01', 'table move-table'],
    ['LA-TEC-UC37-R01-T01', 'entry-point change-entry-point'],
    ['LA-TEC-UC39-R01-T01', 'tooling change-tooling'],
    ['LA-TEC-UC42-R01-T01', 'data-store remove-data-store'],
    ['LA-TST-UC20-R01-T01', 'test-data-set change-test-data-set'],
    ['LA-TST-UC21-R01-T01', 'test-data-set remove-test-data-set'],
    ['LA-UCS-UC08-R01-T01', 'pattern change-pattern-rule'],
  ])('%s refuses a command given nothing, and changes no data file', async (_id, command) => {
    const root = writeData(everyKind());
    const store = await openStore(root);
    const before = files(root);
    await expect(run(store, command, {})).rejects.toThrow(/needs/);
    expect(files(root)).toEqual(before);
    await store.close();
  });
});
