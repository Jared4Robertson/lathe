import { countOf } from '../plural';
import { Dialog } from '../shell/commands';
import { Card, CardGrid } from '../shell/Card';
import { SpaceMark, useSpaces } from '../shell/spaces';
import type { SpecIndex } from '../specs/data';
import { addressOf } from './address';

// The products picker (LA-V97) at `/`, the app's one page of its own: a centered card over the stage
// of the last product the Reader was in, dimmed behind it, or over an empty map on a first launch
// (LA-PAT-APP-UX-R19). Every product is a card that opens its space where the Reader left it. It is a dialog
// like quick find (shell/commands.tsx): Escape or a click on the dimmed stage goes back to the
// product behind it, when there is one.

export function ProductsPicker({ index, onClose }: { index: SpecIndex; onClose: (() => void) | null }) {
  const spaces = useSpaces();
  return (
    <Dialog label="Products" className="products-picker" backdropClassName="products-picker-backdrop" onClose={onClose ?? (() => {})}>
      <header className="products-picker-head">
        <h1>Products</h1>
        <p className="hint">{index.products.length === 0 ? <>No products yet. Run <code>lathe init</code> to add the first to <code>data/product.jsonl</code>.</> : 'Choose a space.'}</p>
      </header>
      <CardGrid label="Products">
        {index.products.map((p) => {
          const space = spaces?.spaces.find((s) => s.id === p.id);
          return (
            <Card
              key={p.id}
              href={spaces?.lastPage(p.id) ?? addressOf(p.id)}
              current={spaces?.last?.id === p.id}
              media={space ? <SpaceMark space={space} size={36} /> : undefined}
              title={<><code>{p.id}</code><strong>{p.title}</strong></>}
            >
              <small>{countOf((index.domainsOf.get(p.id) ?? []).length, 'domain')}</small>
            </Card>
          );
        })}
      </CardGrid>
    </Dialog>
  );
}
