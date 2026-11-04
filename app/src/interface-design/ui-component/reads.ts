import type { UiComponentPage } from '../../../../lathe/src/interface-design/ui-component/read-model';
import { useRead, type Read } from '../../record/read';

// The UI component aggregate's reads as its page makes them (LA-IXD-RM35): a UI component whole as its page shows it
// (get-ui-component), and the next free ID for a UI component of a product (next-id).

/** The UI component, as its page reads it: read again whenever the data is (`version`). */
export const useUiComponent = (id: string, version: unknown): Read<UiComponentPage> => useRead<UiComponentPage>('/api/ui-component/get-ui-component', { id }, version);

/** The next free ID for a UI component of the product, as the editor suggests it. */
export const useNextUiComponentId = (product: string, version: unknown): Read<string> => useRead<string>('/api/ui-component/next-id', { product_id: product }, version);
