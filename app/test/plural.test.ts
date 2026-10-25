import { describe, expect, it } from 'vitest';
import { countOf, plural } from '../src/plural';

describe('plural', () => {
  it('pluralises kind labels as English does', () => {
    expect(plural('Capability')).toBe('Capabilities');
    expect(plural('Use case')).toBe('Use cases');
    expect(plural('UC requirement')).toBe('UC requirements');
    expect(plural('Open question')).toBe('Open questions');
    expect(plural('Fitness')).toBe('Fitness');
    expect(plural('Box')).toBe('Boxes');
    expect(plural('Key')).toBe('Keys');
  });

  it('counts with the singular for one: "1 domain", "4 domains"', () => {
    expect(countOf(1, 'domain')).toBe('1 domain');
    expect(countOf(4, 'domain')).toBe('4 domains');
    expect(countOf(0, 'domain')).toBe('0 domains');
  });
});
