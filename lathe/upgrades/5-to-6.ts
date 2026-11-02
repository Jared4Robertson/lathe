// Schema 5 to 6: domains have a position. Each domain gains `position`, its place among the product's domains, from 1,
// unique within the product: the order the nav, the product page and the graph list them in (they were listed by ID).
// Each product's existing domains are numbered in their current ID order, so nothing an adopter sees changes until the
// Owner reorders them.
import type { Converter } from '../src/upgrade.ts';

/** IDs in ID order: the numbers inside them compared by value (UC2 before UC10), as Lathe sorts them everywhere. */
const collator = new Intl.Collator('en', { numeric: true });

const converter: Converter = {
  files(data, notes) {
    const domains = data.read('domain');
    if (domains.length === 0) return;
    const ordered = [...domains].sort((a, b) => collator.compare(String(a.id), String(b.id)));
    const next = new Map<string, number>();
    const placed = new Map<string, number>();
    for (const d of ordered) {
      const product = String(d.product_id);
      const at = (next.get(product) ?? 0) + 1;
      next.set(product, at);
      placed.set(String(d.id), at);
    }
    // The column sits after product_id, as the table has it.
    data.write(
      'domain',
      domains.map((d) => {
        const row: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(d)) {
          row[key] = value;
          if (key === 'product_id') row.position = placed.get(String(d.id));
        }
        return row;
      }),
    );
    notes.changed(`Each domain has a position: ${domains.length} numbered from 1 within their product, in ID order.`);
  },
};

export default converter;
