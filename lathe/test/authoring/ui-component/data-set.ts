// LA-AUT-TD63 Catalog page: the domain model base with two views, then the CatalogPage UI component written with the
// UI component aggregate's own Add command.
import { ADD_UI_COMPONENT } from '../../../src/authoring/ui-component/commands/add-ui-component.ts';
import { runCommand } from '../../../src/platform/commands/run.ts';
import type { Store } from '../../../src/platform/data/store.ts';
import type { Data } from '../../helpers.ts';
import { domainModelBase, storeOn } from '../domain-model-base.ts';

/** The views it renders: of the View aggregate, so written as data files. */
const VIEWS: Data = {
  view: [
    { id: 'TL-V01', title: 'Catalog', route: '/catalog', description: 'Every tool the library holds.' },
    { id: 'TL-V02', title: 'Loans', description: 'The tools a member has on loan.' },
  ],
};

/** A store with TL-UI01 CatalogPage rendering TL-V01, meeting TL-STD-CODE-R01 and using react, on the base with any extra rows given. */
export async function uiComponentDataSet(extra: Data = {}): Promise<Store> {
  const store = await storeOn(domainModelBase({ ...VIEWS, ...extra }));
  await runCommand(store, ADD_UI_COMPONENT, { id: 'TL-UI01', title: 'CatalogPage', file: 'src/catalog.tsx', description: 'Renders the catalog.', renders: ['TL-V01'], meets: ['TL-STD-CODE-R01'], packages: ['react'] });
  return store;
}
