// An editor's form is drawn from its command's input as its definition gives it (fields.generated.ts, written by
// `npm --prefix lathe run generate`): no editor writes a field's spec or a list of the fields Change may clear by hand.
// A product's own kind is the one exception: its fields are its declaration, read from the data.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { formFields, type InputFields } from '../src/edit/command-form';

const SRC = path.join(import.meta.dirname, '..', 'src');
const DECLARED = ['authoring/extension-record/ExtensionRecordEditor.tsx'];

function editors(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? editors(full) : name.endsWith('Editor.tsx') ? [path.relative(SRC, full)] : [];
  });
}

describe('LA-PAT-FIELD-INPUTS-R03-T01 an editor\'s form fields come from its command\'s generated input', () => {
  it('finds no field spec or clearable list written by hand in an editor, but for a product\'s own kind', () => {
    const found = editors(SRC);
    expect(found.length).toBeGreaterThan(20);
    const restated = found.filter((file) => !DECLARED.includes(file)).filter((file) => /\{ field: '|clearable: (\[|readonly)/.test(readFileSync(path.join(SRC, file), 'utf8')));
    expect(restated).toEqual([]);
  });

  it('draws each field in the input\'s order with its kind, required and clearable, leaving out what the form sends itself', () => {
    const input = {
      id: { kind: 'column', table: 'thing', column: 'id', required: true, clearable: false },
      parent_id: { kind: 'column', table: 'thing', column: 'parent_id', required: true, clearable: false },
      notes: { kind: 'column', table: 'thing', column: 'notes', required: false, clearable: true },
      has_one: { kind: 'ids', description: 'What it holds one of.', required: false, clearable: false },
      kind_id: { kind: 'column', table: 'thing', column: 'kind_id', required: false, clearable: true },
    } as const satisfies InputFields;
    const choices = [{ id: 'K1', title: 'A kind' }];
    expect(formFields(input, ['parent_id'], { notes: { long: true }, kind_id: { label: 'Kind', choices } })).toEqual([
      { field: 'id', clearable: false, column: 'id', table: 'thing', required: true },
      { field: 'notes', clearable: true, column: 'notes', table: 'thing', long: true },
      { field: 'has_one', clearable: false, label: 'Has one', description: 'What it holds one of.', many: [] },
      { field: 'kind_id', clearable: true, column: 'kind_id', table: 'thing', label: 'Kind', choices },
    ]);
  });
});
