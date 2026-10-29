import { countOf } from '../plural';
import { Dialog } from '../shell/commands';
import { Card, CardGrid } from '../shell/Card';
import { SpaceMark, useSpaces } from '../shell/spaces';
import type { SpecIndex } from '../specs/data';
import { addressOf } from './address';

// The products picker (LA-V97) at `/`, the app's one page of its own: a centered card over the stage
// of the last product the Reader was in, dimmed behind it, or over an empty map on a first launch
// (LA-PAT-APP-UX-R20). Every product, as the Product aggregate lists it, is a card that opens its space where the Reader
// left it. It is a dialog
// like quick find (shell/commands.tsx): Escape or a click on the dimmed stage goes back to the
// product behind it, when there is one.

export function ProductsPicker({ index, onClose }: { index: SpecIndex; onClose: (() => void) | null }) {
  const spaces = useSpaces();
  return (
    <Dialog label="Products" className="products-picker" backdropClassName="products-picker-backdrop" onClose={onClose ?? (() => {})}>
      <header className="products-picker-head">
        <h1>Products</h1>
        <p className="hint">{spaces?.read && spaces.spaces.length === 0 ? <>No products yet. Run <code>lathe init</code> to add the first to <code>data/product.jsonl</code>.</> : 'Choose a space.'}</p>
      </header>
      <CardGrid label="Products">
        {(spaces?.spaces ?? []).map((space) => (
            <Card
              key={space.id}
              href={spaces?.lastPage(space.id) ?? addressOf(space.id)}
              current={spaces?.last?.id === space.id}
              media={<SpaceMark space={space} size={36} />}
              title={<><code>{space.id}</code><strong>{space.title}</strong></>}
            >
              <small>{countOf((index.domainsOf.get(space.id) ?? []).length, 'domain')}</small>
            </Card>
        ))}
      </CardGrid>
    </Dialog>
  );
}
