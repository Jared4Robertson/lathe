import { readFileSync } from 'node:fs';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ColumnDescription } from '../../lathe/src/platform/data/schema';
import { ColumnField, columnValue } from '../src/edit/fields';

// The shared field inputs (LA-PAT-FIELD-INPUTS): one input per column type, knowing no kind.

const column = (kind: ColumnDescription['kind'], over: Partial<ColumnDescription> = {}): ColumnDescription =>
  ({ name: 'field', sqlType: 'VARCHAR', kind, required: false, description: 'What it means.', ...over });

describe('LA-PAT-FIELD-INPUTS-R01-T01 LA-PAT-FIELD-INPUTS-R01-T02 LA-PAT-FIELD-INPUTS-R01-T03 LA-PAT-FIELD-INPUTS-R01-T04 LA-PAT-FIELD-INPUTS-R01-T05 LA-PAT-FIELD-INPUTS-R01-T06 a field\'s input follows its column\'s type', () => {
  it('gives each column type its input, labeled and described by its column', () => {
    const field = (c: ColumnDescription, label: string, long = false) => render(<ColumnField id={label} column={c} label={label} value="" long={long} onChange={() => {}} />);
    field(column('enum', { values: ['unit', 'browser'], required: true }), 'level');
    field(column('integer', { required: true }), 'position');
    field(column('text_list'), 'steps');
    field(column('boolean', { required: true }), 'published');
    field(column('boolean'), 'smoke');
    field(column('text'), 'title');
    field(column('text'), 'goal', true);
    expect(screen.getByRole('combobox', { name: /^level/ })).toHaveAccessibleDescription('What it means.');
    expect(screen.getByRole('spinbutton', { name: /^position/ })).toHaveAttribute('aria-required', 'true');
    expect(screen.getByRole('textbox', { name: /^steps/ }).tagName).toBe('TEXTAREA');
    expect(screen.getByRole('checkbox', { name: /^published/ })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /^smoke/ })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /^title/ }).tagName).toBe('INPUT');
    expect(screen.getByRole('textbox', { name: /^goal/ }).tagName).toBe('TEXTAREA');
  });

  it('turns an input\'s text into its column\'s value, and leaves a value not of its type for the command to refuse', () => {
    expect(columnValue(column('integer'), ' 3 ')).toBe(3);
    expect(columnValue(column('integer'), 'three')).toBe('three');
    expect(columnValue(column('boolean'), 'true')).toBe(true);
    expect(columnValue(column('text_list'), 'one\n\n two ')).toEqual(['one', 'two']);
    expect(columnValue(column('text'), '  ')).toBeUndefined();
  });
});

describe('LA-PAT-FIELD-INPUTS-R02-T01 LA-PAT-FIELD-INPUTS-R02-T02 LA-PAT-FIELD-INPUTS-R02-T03 LA-PAT-FIELD-INPUTS-R02-T04 LA-PAT-FIELD-INPUTS-R02-T05 LA-PAT-FIELD-INPUTS-R02-T06 a shared field input knows no kind', () => {
  it('imports nothing of the specs, the aggregates\' slices or the shell, and names no kind', () => {
    const text = readFileSync(path.join(import.meta.dirname, '../src/edit/fields.tsx'), 'utf8');
    const imports = [...text.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
    expect(imports.filter((i) => /specs|product|domain-modeling|use-cases|interface-design|technical-specification|test-planning|shell|graph|views/.test(i))).toEqual([]);
    expect(text).not.toMatch(/use_case|flow_step|uc_requirement/);
  });
});
