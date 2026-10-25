import { describe, expect, it } from 'vitest';
import { plural } from '../src/plural';

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
});
