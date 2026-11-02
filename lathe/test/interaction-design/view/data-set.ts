// LA-IXD-TD60 Catalog and Loans views: the domain model base, the Catalog and Loans views written with the View
// aggregate's own Add commands, then a UI component that renders the catalog.
import { ADD_VIEW } from '../../../src/interaction-design/view/commands/add-view.ts';
import { ADD_VIEW_REQUIREMENT } from '../../../src/interaction-design/view/commands/add-view-requirement.ts';
import { ADD_VIEW_TEST } from '../../../src/interaction-design/view/commands/add-view-test.ts';
import { ADD_UI_COMPONENT } from '../../../src/interaction-design/ui-component/commands/add-ui-component.ts';
import { runCommand } from '../../../src/platform/commands/run.ts';
import type { Store } from '../../../src/platform/data/store.ts';
import type { Data } from '../../helpers.ts';
import { domainModelBase, storeOn } from '../../domain-modeling/domain-model-base.ts';

/**
 * A store with TL-V01 Catalog (route /catalog, requirement R01 with its test, which starts from TL-LEND-TD01), which
 * TL-UI01 renders, and TL-V02 Loans with nothing under it, on the base with any extra rows given.
 */
export async function viewDataSet(extra: Data = {}): Promise<Store> {
  const store = await storeOn(domainModelBase(extra));
  const run = (definition: Parameters<typeof runCommand>[1], input: unknown) => runCommand(store, definition, input);
  await run(ADD_VIEW, { id: 'TL-V01', title: 'Catalog', route: '/catalog', description: 'Every tool the library holds, with whether it is free.' });
  await run(ADD_VIEW, { id: 'TL-V02', title: 'Loans', description: 'The tools a member has on loan.' });
  await run(ADD_VIEW_REQUIREMENT, { id: 'TL-V01-R01', title: 'A tool on loan shows its due date', view_id: 'TL-V01', statement: 'A tool on loan MUST show the date it is due back.' });
  await run(ADD_VIEW_TEST, {
    id: 'TL-V01-R01-T01', title: 'A tool on loan shows its due date', view_requirement_id: 'TL-V01-R01', level: 'browser', state: 'automated', file: 'test/catalog.spec.ts',
    when: 'Opens the catalog with one tool on loan.', then: 'The tool shows its due date.', starts_from: ['TL-LEND-TD01'],
  });
  await run(ADD_UI_COMPONENT, { id: 'TL-UI01', title: 'CatalogPage', file: 'src/catalog.tsx', description: 'Renders the catalog.', renders: ['TL-V01'] });
  return store;
}
