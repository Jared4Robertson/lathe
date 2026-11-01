// The app's form fields, generated from the command definitions' inputs: for each command slice, the app's
// app/src/<same folders>/fields.generated.ts holds each command's input by route, one entry per field with its name,
// what it is (a column of a table, a record's ID, a list of IDs or texts, a list of a part table's rows, a declared
// kind's values or links), its description, and whether it is required and whether Change may clear it with null.
// The editors draw their forms from these and add only what the input cannot say: labels, long text, the choices.
import path from 'node:path';
import type { Field } from '../../src/platform/commands/definition.ts';
import { readIdentities } from './identities.ts';
import { GENERATED_HEADER, type Generated } from './output.ts';
import { ALL_COMMANDS } from '../../src/commands.ts';

const quote = (text: string) => `'${text.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
const snake = (name: string) => name.toUpperCase().replaceAll('-', '_');

/** What a description says of the command alone (a list replaces, null or an empty list clears): the CLI's and the tools' help, not a form's. */
export const COMMAND_ONLY = /\b(replaces?|clears?|null)\b/i;

/**
 * A field's description as a form shows it: the definition's, without the sentences or clauses (after a ; or :) that
 * say how the command treats the value, since a person in a form sees the list or value they are editing.
 */
export function formDescription(description: string): string {
  const sentences = description.split(/(?<=\.)\s+/).map((sentence) => {
    const clauses = sentence.replace(/\.$/, '').split(/(?=[;:]\s)/);
    const kept = [clauses[0], ...clauses.slice(1).filter((c) => !COMMAND_ONLY.test(c))];
    return COMMAND_ONLY.test(kept[0]) ? '' : `${kept.join('')}.`;
  });
  return sentences.filter(Boolean).join(' ');
}

/** One field as a literal, its keys in one order. */
function fieldText(field: Field): string {
  const parts = [`kind: ${quote(field.kind)}`];
  if ('table' in field) parts.push(`table: ${quote(field.table)}`);
  if ('column' in field) parts.push(`column: ${quote(field.column)}`);
  if ('columns' in field) parts.push(`columns: [${field.columns.map(quote).join(', ')}]`);
  if ('description' in field) parts.push(`description: ${quote(formDescription(field.description))}`);
  parts.push(`required: ${field.required}`, `clearable: ${field.clearable}`);
  return `{ ${parts.join(', ')} }`;
}

/** Each command slice's fields file in the app, from its definitions' inputs, in its commands' order. */
export function fieldFiles(repo: string): Generated {
  const dirOf = new Map(readIdentities(repo).map((d) => [d.id, d.slice.dir]));
  const slices = new Map<string, { name: string; dir: string; commands: (typeof ALL_COMMANDS)[number][] }>();
  for (const command of ALL_COMMANDS) {
    // A definition with no records of its identity has nothing generated for it (the identities' freshness refuses it).
    const dir = dirOf.get(command.id);
    if (!dir) continue;
    const slice = slices.get(dir) ?? { name: command.slice.name, dir, commands: [] };
    slice.commands.push(command);
    slices.set(dir, slice);
  }
  const files: Generated = new Map();
  for (const { name, dir, commands } of slices.values()) {
    const file = `${dir.replace(/^lathe\/src\//, 'app/src/')}/fields.generated.ts`;
    const edit = path.relative(path.dirname(file), 'app/src/edit/command-form');
    files.set(file, [
      GENERATED_HEADER,
      `// The ${name} commands' inputs, by route, from their definitions: what the editors' forms are drawn from.`,
      `import type { InputFields } from '${edit}';`,
      '',
      `export const ${snake(name)}_FIELDS = {`,
      ...commands.flatMap((c) => [
        `  ${quote(c.route)}: {`,
        ...Object.entries(c.input).map(([field, f]) => `    ${field}: ${fieldText(f)},`),
        '  },',
      ]),
      '} as const satisfies Record<string, InputFields>;',
      '',
    ].join('\n'));
  }
  return files;
}
