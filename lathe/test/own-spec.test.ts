// Lathe's own spec held to its own rules: what its statements say, and the modeling skill its Agent follows.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { openStore } from '../src/index.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(here, '..', '..');

/** The kinds whose statement states a rule: everything owed but specifications, policies and domain services, which define or react. */
const RULE_KINDS = ['constraint', 'invariant', 'uc_requirement', 'view_requirement', 'api_requirement', 'pattern_rule', 'standard_rule'];

/** The kinds titled by a name (LA-STD-MODELING-R05): a proper name or a noun phrase, one to four words. */
const NAME_KINDS = ['product', 'integration', 'interface', 'domain', 'capability', 'aggregate', 'entity', 'value_object', 'term', 'read_model', 'pattern', 'standard', 'domain_service', 'view', 'ui_component', 'test_data_set', 'business_outcome'];

/** Lathe's own spec and the Tool Library's. */
const PRODUCTS = [
  { root: REPO, dataDir: path.join(REPO, 'data') },
  { root: path.join(REPO, 'examples', 'tool-library'), dataDir: path.join(REPO, 'examples', 'tool-library', 'data') },
];

/** Each record of the kinds in both products, as "ID: title". */
async function titles(kinds: string[]): Promise<{ id: string; title: string }[]> {
  const found: { id: string; title: string }[] = [];
  for (const { root, dataDir } of PRODUCTS) {
    const store = await openStore(root, { dataDir });
    try {
      for (const kind of kinds) for (const r of store.rows(kind)) found.push({ id: String(r.id), title: String(r.title) });
    } finally {
      await store.close();
    }
  }
  return found;
}

describe("Lathe's own spec", () => {
  it('LA-STD-MODELING-R05-T01 Every name in Lathe and the Tool Library is one to four words with no article first', async () => {
    const named = await titles(NAME_KINDS);
    expect(named.length).toBeGreaterThan(100);
    const off = named.filter(({ title }) => {
      const words = title.trim().split(/\s+/);
      return words.length > 4 || /^(a|an|the)$/i.test(words[0]);
    });
    expect(off).toEqual([]);
  });

  it('LA-STD-MODELING-R07-T01 Every policy in Lathe and the Tool Library reads "When" an event, then its reaction', async () => {
    const policies = await titles(['policy']);
    expect(policies.length).toBeGreaterThan(1);
    expect(policies.filter(({ title }) => !/^When [^,]+, \S/.test(title))).toEqual([]);
  });

  it("LA-VO03-C02-T Every rule in Lathe's own spec states it with MUST, SHOULD or MAY under a short title", async () => {
    const store = await openStore(REPO, { dataDir: path.join(REPO, 'data') });
    try {
      const rules = RULE_KINDS.flatMap((kind) => store.rows(kind).map((r) => ({ kind, id: String(r.id), title: String(r.title), statement: String(r.statement) })));
      expect(rules.length).toBeGreaterThan(0);
      const unstated = rules.filter((r) => !/\b(MUST|SHOULD|MAY)\b/.test(r.statement)).map((r) => r.id);
      const longTitles = rules.filter((r) => r.title.split(/\s+/).length > 15).map((r) => r.id);
      expect({ unstated, longTitles }).toEqual({ unstated: [], longTitles: [] });
    } finally {
      await store.close();
    }
  });

  it("LA-AUT-UC02-R02-T01 The modeling skill's first step finds the business capabilities and makes each a slice, with the questions that tell one from a layer", () => {
    const skill = readFileSync(path.join(REPO, 'plugin', 'skills', 'model-a-domain', 'SKILL.md'), 'utf8');
    const headings = [...skill.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
    expect(headings[0]).toBe('Step one: find the slices');
    const step = skill.split(/^## /m).find((s) => s.startsWith('Step one')) ?? '';
    expect(step).toContain("Before you write any record, find the product's business capabilities and make each one a domain");
    expect(step.match(/^- .+\?/gm)?.length ?? 0).toBeGreaterThanOrEqual(4);
  });
});
