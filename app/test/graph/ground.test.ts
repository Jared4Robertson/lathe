import { describe, expect, it } from 'vitest';
import { composes } from '../../src/graph/composition';
import { groundTree, LEAF_H, LEAF_W, LEVEL, RECORD_PAD, type GroundMap, type GroundNode } from '../../src/graph/ground';
import { compareIds, type RecordIndex } from '../../src/exploring/record-summaries/record-index';
import { recordIndexOf } from '../read-view';
import { groupedWorkspace, testIndex } from './workspace';
import { groundMap } from './maps';

// The Graph's Map layout (LA-EXP-DS12): districts as ground, every leaf record one size, a record nesting in its parent
// only as its composition (LA-STD-MODELING-R14), containers as big as what they hold.

let built: RecordIndex[] | null = null;
const indexes = (): RecordIndex[] => (built ??= [testIndex(), recordIndexOf(groupedWorkspace())]);
const eps = 1e-9;

describe('the composition rule', () => {
  it('LA-STD-MODELING-R14-T01 A record nests in its parent only when it is the parent\'s composition; every other parent is a link', () => {
    for (const [parent, child] of [
      ['aggregate', 'entity'], ['entity', 'command'], ['use_case', 'uc_requirement'], ['use_case', 'flow'], ['flow', 'flow_step'], ['journey', 'journey_step'],
      ['pattern', 'pattern_rule'], ['standard', 'standard_rule'], ['value_object', 'constraint'], ['read_model', 'query'], ['read_model', 'projection'],
      ['read_model', 'reader'], ['endpoint', 'api_requirement'], ['view', 'view_requirement'],
      ['uc_requirement', 'use_case_test'], ['constraint', 'constraint_test'], ['flow', 'flow_test'], ['standard_rule', 'standard_rule_test'],
    ]) expect(composes(parent, child), `${child} in ${parent}`).toBe(true);
    for (const [parent, child] of [
      ['domain', 'aggregate'], ['aggregate', 'invariant'], ['aggregate', 'domain_event'], ['command', 'policy'], ['domain', 'use_case'],
      ['command', 'endpoint'], ['entity', 'table'], ['command', 'command_handler'], ['product', 'pattern'], ['invariant', 'rule'],
    ]) expect(composes(parent, child), `${child} in ${parent}`).toBe(false);
  });

  it('LA-STD-MODELING-R14-T02 In the Map every record sits in an area or inside the record it is part of, and in each just once', () => {
    for (const index of indexes()) {
      const map = groundMap(index);
      const records = [...map.nodes.values()].filter((n) => n.role === 'record');
      expect(new Set(records.map((n) => n.id)).size).toBe(records.length);
      for (const n of records) {
        const up = map.nodes.get(n.parent!)!;
        if (up.role !== 'record') continue;
        expect(composes(index.byId.get(up.id)!.kind, index.byId.get(n.id)!.kind), `${n.id} in ${up.id}`).toBe(true);
        expect(index.byId.get(n.id)!.parent).toBe(up.id);
      }
      // A record that is part of another is inside it, wherever its folder lists it.
      for (const n of records) for (const c of index.children.get(n.id) ?? []) if (composes(index.byId.get(n.id)!.kind, c.kind)) expect(map.nodes.get(c.id)?.parent).toBe(n.id);
    }
  });
});

describe('the Map\'s sizes, bottom-up', () => {
  it('LA-EXP-DS12-T01 Every leaf record is one size; every container holds its children inside its padding, none overlapping, and is no bigger than they need', () => {
    for (const index of indexes()) {
      const map = groundMap(index);
      for (const n of map.nodes.values()) {
        expect(n.text).toBe(1);
        if (n.role === 'record' && n.children.length === 0) { expect([n.w, n.h]).toEqual([LEAF_W, LEAF_H]); continue; }
        if (n.children.length === 0) continue;
        const pad = n.role === 'record' ? RECORD_PAD : LEVEL[n.role].pad;
        const kids = n.children.map((c) => map.nodes.get(c)!);
        for (const k of kids) {
          expect(k.x).toBeGreaterThanOrEqual(n.x + pad - eps);
          expect(k.y).toBeGreaterThanOrEqual(n.y + n.header - eps);
          expect(k.x + k.w).toBeLessThanOrEqual(n.x + n.w - pad + eps);
          expect(k.y + k.h).toBeLessThanOrEqual(n.y + n.h - pad + eps);
        }
        for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++) {
          const [a, b] = [kids[i], kids[j]];
          expect(a.x + a.w <= b.x + eps || b.x + b.w <= a.x + eps || a.y + a.h <= b.y + eps || b.y + b.h <= a.y + eps, `${a.id} and ${b.id}`).toBe(true);
        }
        // Exactly as big as what it holds: its children reach its padding on the right (or it is a leaf's width) and at its bottom.
        const right = Math.max(...kids.map((k) => k.x + k.w));
        const bottom = Math.max(...kids.map((k) => k.y + k.h));
        expect(Math.abs(n.y + n.h - pad - bottom)).toBeLessThan(1e-6);
        expect(Math.abs(n.x + n.w - pad - right) < 1e-6 || n.w <= LEAF_W + 2 * pad + eps).toBe(true);
      }
    }
  });

  it('LA-EXP-DS12-T01 A container\'s records keep reading order, row by row', () => {
    for (const index of indexes()) {
      const map = groundMap(index);
      for (const n of map.nodes.values()) {
        if (n.role === 'district' || n.role === 'ground') continue;
        const kids = n.children.map((c) => map.nodes.get(c)!);
        for (let i = 1; i < kids.length; i++) {
          const [a, b] = [kids[i - 1], kids[i]];
          expect(b.y > a.y + eps || (Math.abs(b.y - a.y) < eps && b.x > a.x), `${a.id} before ${b.id}`).toBe(true);
        }
      }
    }
  });
});

describe('the Map\'s districts', () => {
  const kids = (map: GroundMap, id: string): GroundNode[] => map.nodes.get(id)!.children.map((c) => map.nodes.get(c)!);

  it('LA-EXP-DS12-T02 The product is the ground; its shared records a district first, then each domain a district, in ID order', () => {
    const index = testIndex();
    const map = groundMap(index);
    const ground = map.nodes.get(map.roots[0])!;
    expect(ground.id).toBe('P');
    expect(ground.role).toBe('ground');
    const districts = kids(map, 'P');
    expect(districts.every((d) => d.role === 'district')).toBe(true);
    expect(districts.map((d) => d.id)).toEqual(['P/shared', ...index.domains.map((d) => d.id).sort(compareIds)]);
  });

  it('LA-EXP-DS12-T02 A district\'s stages are neighborhoods left to right in stage order, a stage\'s folders areas inside it', () => {
    for (const index of indexes()) {
      const map = groundMap(index);
      const rank = (id: string) => index.meta.stages.findIndex((s) => s.stage === id.split('/')[1]);
      for (const d of kids(map, map.roots[0])) {
        const hoods = kids(map, d.id).filter((n) => n.role === 'neighborhood');
        for (let i = 1; i < hoods.length; i++) {
          expect(rank(hoods[i].id)).toBeGreaterThan(rank(hoods[i - 1].id));
          expect(hoods[i].x).toBeGreaterThan(hoods[i - 1].x + hoods[i - 1].w);
          expect(hoods[i].y).toBe(hoods[i - 1].y);
        }
        for (const h of hoods) for (const a of kids(map, h.id)) expect(['area', 'record']).toContain(a.role);
      }
    }
  });

  it('LA-EXP-DS12-T02 Each area counts the records it holds at every depth', () => {
    const map = groundMap(testIndex());
    const count = (id: string): number => map.nodes.get(id)!.children.reduce((s, c) => s + (map.nodes.get(c)!.role === 'record' ? 1 : 0) + count(c), 0);
    for (const n of map.nodes.values()) expect(n.count).toBe(count(n.id));
    expect(groundTree(testIndex()).root).toBe('P');
  });
});
