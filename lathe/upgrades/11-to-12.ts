// Schema 11 to 12: a guarantee is a promise kept by shared code, made by its maker: a platform domain, to the other
// domains of its product, or, new, a generated component or a library the product ships, to the outside consumers the
// guarantee names (consumers). A guarantee gains its maker's two columns, consumers and group_name, and may follow a
// standard rule (meets); a generated component or a library may serve business outcomes; a pattern may name the maker
// of its fixed part (made_by). The new tables start empty and no row changes: every guarantee keeps its platform
// domain. What a product wrote as its own kinds for such promises, the converter cannot rewrite (a product's own kinds
// are the product's), so each of its own obligation kinds is a to-do for the Owner to weigh.
import type { Converter } from '../src/upgrade.ts';

/** Kind names in name order. */
const byName = (a: string, b: string) => a.localeCompare(b);

const converter: Converter = {
  files(data, notes) {
    const kinds = data.read('product_kind');
    const obligations = kinds.filter((k) => k.obligation === true).map((k) => String(k.name)).sort(byName);
    // Data with a generated component or a library is data already upgraded.
    if (obligations.length === 0 || data.read('generated_component').length > 0 || data.read('library').length > 0) return;
    const count = (kind: string) => data.read(kind).length;
    const under = (kind: string) => kinds.filter((k) => k.parent_kind === kind).map((k) => String(k.name)).sort(byName);
    notes.changed('A guarantee may be made by a generated component or a library, for the outside consumers it names, as well as by a platform domain.');
    for (const kind of obligations) {
      const children = under(kind);
      notes.todo(
        `Your own kind ${kind} holds ${count(kind)} ${count(kind) === 1 ? 'record' : 'records'}: if each is a promise shared code keeps, of a platform domain, of a unit your generator emits or of a library you ship, write it as a guarantee of that maker (\`lathe generated-component add-generated-component\`, \`lathe library add-library\`, \`lathe guarantee add-guarantee\`) with whom it is for (consumers), its guarantee tests${children.length ? ` (from ${children.join(', ')})` : ''} and the building blocks that keep it (kept_by), then remove the kind.`,
      );
    }
  },
};

export default converter;
