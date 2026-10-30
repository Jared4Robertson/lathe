import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// The large product the big-map scenarios measure (LA-PLT-TD04): Lathe's own product with each of its domains copied
// COPIES times over beside it, under new domain codes (LA-AUT, LA-AUTB, LA-AUTC…), about ten times Lathe's records in
// one product, so the Graph, the ERD and the Trace each draw one map about ten times Lathe's. Deterministic: the same
// data always gives the same product. A row a domain owns (its ID, or a link's source, under a domain) is copied with
// every domain code in it moved to the copy's, so each copy links within itself as Lathe's domains do; a product-wide
// row is kept once.

/** How many copies of each domain the product holds beside the original: Lathe's domains hold about three quarters of its records. */
export const COPIES = 12;
const SUFFIXES = 'BCDEFGHIJKLM';

const titled = (title: string, letter: string) => {
  if (/\s/.test(title)) return `${title} ${letter}`;
  if (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(title)) return `${title}-${letter.toLowerCase()}`;
  return `${title}${letter}`;
};

/** The large product's folder: a copy of `repo`'s config and data with its domains copied, in a new temporary folder. */
export function largeProduct(repo: string): string {
  const root = mkdtempSync(path.join(tmpdir(), 'lathe-large-'));
  const source = path.join(repo, 'data');
  const domains = readFileSync(path.join(source, 'domain.jsonl'), 'utf8').split('\n').filter(Boolean).map((line) => String(JSON.parse(line).id));
  // A domain's code anywhere in a row: not inside a longer ID part.
  const codes = new RegExp(`(?<![A-Za-z0-9])(${domains.map((d) => d.replace(/[-]/g, '\\-')).join('|')})(?![A-Za-z0-9])`, 'g');
  const owned = (row: Record<string, unknown>) => {
    const key = row.id ?? row.source_id;
    return typeof key === 'string' && domains.some((d) => key === d || key.startsWith(`${d}-`));
  };
  mkdirSync(path.join(root, 'data'));
  for (const file of readdirSync(source).filter((f) => f.endsWith('.jsonl')).sort()) {
    const lines = readFileSync(path.join(source, file), 'utf8').split('\n').filter(Boolean);
    const out: string[] = [];
    for (const line of lines) {
      out.push(line);
      if (!owned(JSON.parse(line))) continue;
      for (let i = 0; i < COPIES; i++) {
        const copy = JSON.parse(line.replace(codes, (d) => `${d}${SUFFIXES[i]}`)) as Record<string, unknown>;
        // A title is unique in its product: each copy's ends with its copy's letter, a word of its own, a kebab-case name's
        // last word (a check row's), or an identifier's last character (a code-bound record's).
        if (typeof copy.title === 'string') copy.title = titled(copy.title, SUFFIXES[i]);
        // An endpoint is titled by its method and route, so its route takes the letter.
        if (typeof copy.route === 'string') { copy.route = `${copy.route}/${SUFFIXES[i]}`; copy.title = `${copy.method} ${copy.route}`; }
        out.push(JSON.stringify(copy));
      }
    }
    writeFileSync(path.join(root, 'data', file), `${out.join('\n')}\n`);
  }
  // Its own config: Lathe's, without the other products it lists.
  const config = JSON.parse(readFileSync(path.join(repo, 'lathe.config.json'), 'utf8')) as Record<string, unknown>;
  writeFileSync(path.join(root, 'lathe.config.json'), `${JSON.stringify({ ...config, products: [] }, null, 2)}\n`);
  // The code folders are linked, so a record's file resolves as it does in the repo.
  for (const dir of ['app', 'lathe', 'desktop', 'examples', 'plugin']) if (existsSync(path.join(repo, dir))) symlinkSync(path.join(repo, dir), path.join(root, dir));
  return root;
}
