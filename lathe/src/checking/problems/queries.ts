// The Problems read (LA-CHK-RM01): a product's problems as its Checks panel lists them, answered from the read model
// through its reader (reader.ts). The problems are the checks' run's, so the query says it reads the run (`checked`):
// the server gives it the run it keeps for the data, the CLI and the MCP tool run the checks first. Its handler never
// sees the data and changes nothing. The checks themselves are the Check aggregate's (checking/check); this slice holds
// only the read, so it names its read model where an aggregate's slice names its aggregate.
import { id, type QueryDefinition } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { CheckProblems, ProductProblems } from './read-model.ts';
import { problemsReader, type ProblemsReader } from './reader.ts';
import { LIST_PROBLEMS_IDENTITY } from './queries.generated.ts';

/** The product's problems by check, errors first, then the workspace's by check, with the counts. */
export function listProblems(reader: ProblemsReader, input: { product_id: string }): ProductProblems {
  const problems = reader.problemsOf(input.product_id);
  if (!problems) throw new StoreError([{ rule: 'missing', message: `there is no product ${input.product_id}` }]);
  return problems;
}

/** One check's problems as lines of text. */
const checkText = (group: CheckProblems, indent: string) => [
  `${indent}${group.check} (${group.problems.length})`,
  ...group.problems.map((p) => `${indent}  ${p.severity}${p.record ? ` ${p.record}` : ''}: ${p.message}`),
];

/** List a product's problems (LA-CHK-QRY02). */
export const LIST_PROBLEMS: QueryDefinition<{ product_id: string }, ProductProblems, ProblemsReader> = {
  ...LIST_PROBLEMS_IDENTITY,
  input: { product_id: id('The product.', 'required') },
  checked: true,
  reader: problemsReader,
  run: listProblems,
  text: (p) =>
    [
      `${p.product}: ${p.errors} error${p.errors === 1 ? '' : 's'} · ${p.warnings} warning${p.warnings === 1 ? '' : 's'}`,
      ...p.own.flatMap((g) => checkText(g, '  ')),
      ...(p.workspace.length ? ['  Workspace', ...p.workspace.flatMap((g) => checkText(g, '    '))] : []),
    ].join('\n'),
};
