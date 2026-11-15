// Schema 10 to 11: a platform domain is described by its guarantees. A guarantee is a promise a platform domain makes
// to every other domain, proved by its guarantee tests and kept by the building blocks (technical records and data
// stores) it names with kept_by; a standard may sit under a platform domain as well as under its product. The new
// tables start empty and no row changes. A platform domain has no goals of its own, so it holds no use case,
// aggregate, read model or view: lathe check reports each one it still holds (platform-holds-business-record), and
// turning them into guarantees is the Owner's to do.
import type { Converter } from '../src/upgrade.ts';

/** IDs in ID order: the numbers inside them compared by value (UC2 before UC10), as Lathe sorts them everywhere. */
const collator = new Intl.Collator('en', { numeric: true });

const counted = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const converter: Converter = {
  files(data, notes) {
    const platforms = data.read('domain').filter((d) => d.platform === true).map((d) => String(d.id)).sort(collator.compare);
    // Data with a guarantee is data already upgraded.
    if (platforms.length === 0 || data.read('guarantee').length > 0) return;
    notes.changed(`A platform domain is described by its guarantees, each proved by its guarantee tests and kept by its building blocks: ${platforms.join(', ')} has none yet.`);
    const inDomain = (table: string, domain: string) => data.read(table).filter((r) => r.domain_id === domain).length;
    for (const domain of platforms) {
      const held = [
        [inDomain('use_case', domain), 'use case', 'use cases'],
        [inDomain('aggregate', domain), 'aggregate', 'aggregates'],
        [inDomain('read_model', domain), 'read model', 'read models'],
      ] as const;
      const named = held.filter(([n]) => n > 0).map(([n, one, many]) => counted(n, one, many));
      notes.todo(
        named.length
          ? `${domain} is a platform domain and holds ${named.join(', ')}: write each promise the other domains rely on as a guarantee (\`lathe guarantee add-guarantee\`) with its guarantee tests and the building blocks that keep it, then remove them.`
          : `Write each promise ${domain} makes to the other domains as a guarantee (\`lathe guarantee add-guarantee\`), with its guarantee tests and the building blocks that keep it.`,
      );
    }
  },
};

export default converter;
