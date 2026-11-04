// Schema 6 to 7: flows belong to the use cases stage, and interaction design is interface design. A flow and its steps
// are how a use case is carried out whatever the interface, so they move from the fourth stage to use cases; the fourth
// stage, left with the product's interfaces and what a step reaches through them (views, endpoints, integrations), is
// renamed interface design, its key interface-design. The stage is the schema's for Lathe's kinds, so only a product's
// own kinds store it: each one in interaction-design is now in interface-design. A product's own kind that is really a
// step's scenario rather than an interface's how is the Owner's to move, so the converter says where its kinds went.
import type { Converter } from '../src/upgrade.ts';

const converter: Converter = {
  files(data, notes) {
    const kinds = data.read('product_kind');
    const moved = kinds.filter((k) => k.stage === 'interaction-design');
    if (moved.length === 0) return;
    data.write('product_kind', kinds.map((k) => (k.stage === 'interaction-design' ? { ...k, stage: 'interface-design' } : k)));
    notes.changed(`Interaction design is interface design: ${moved.length} of the product's own kinds (${moved.map((k) => String(k.name)).join(', ')}) moved to stage interface-design.`);
  },
};

export default converter;
