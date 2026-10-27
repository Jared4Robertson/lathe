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

describe("Lathe's own spec", () => {
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
