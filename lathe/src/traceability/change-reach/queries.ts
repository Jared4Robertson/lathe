// The Change reach read (LA-TRC-RM14): what a change of some records would touch, before it is made, answered from the
// read model through its reader (reader.ts). The chains are the checks' run's, so the query says it reads the run
// (`checked`): the server gives it the run it keeps for the data, the CLI and the MCP tool run the checks first. Its
// handler never sees the data and changes nothing. This slice holds only the read, so it names its read model where an
// aggregate's slice names its aggregate.
import { ids, type QueryDefinition } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { ChangeReach, ReachHop } from './read-model.ts';
import { changeReachReader, type ChangeReachReader } from './reader.ts';
import { GET_REACH_IDENTITY } from './queries.generated.ts';

/** Everything a change of the records would touch, grouped by stage, with its files and purposes. */
export function getReach(reader: ChangeReachReader, input: { ids: string[] }): ChangeReach {
  if (input.ids.length === 0) throw new StoreError([{ rule: 'missing', message: 'name at least one record to change' }]);
  const missing = reader.missing(input.ids);
  if (missing.length > 0) throw new StoreError(missing.map((id) => ({ rule: 'missing', message: `there is no record ${id}` })));
  return reader.reachOf(input.ids);
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
/** A path read from the record reached back to the changed record: "builds LA-X-H, which sits under …". */
const pathWords = (path: readonly ReachHop[]): string =>
  path.slice(1).reverse().map((h, i, hops) => `${h.via?.toLowerCase()} ${i + 1 < hops.length ? hops[i + 1].id : path[0].id}`).join(', which ');
const listed = (label: string, ids: readonly string[]) => (ids.length ? [`  ${label}: ${ids.join(', ')}`] : []);

/** Get the reach of a change (LA-TRC-QRY20). */
export const GET_REACH: QueryDefinition<{ ids: string[] }, ChangeReach, ChangeReachReader> = {
  ...GET_REACH_IDENTITY,
  input: { ids: ids('The records to change, the flag once per record.', 'required') },
  checked: true,
  reader: changeReachReader,
  run: getReach,
  text: (r) =>
    [
      `Changing ${r.changed.join(', ')} touches ${plural(r.count, 'record')}.`,
      ...r.groups.flatMap((g) => [
        `${g.label} (${g.records.length}):`,
        ...g.records.map((x) => {
          const facts = [x.state, x.file].filter((f) => f !== null).join(', ');
          return `  ${x.id}${facts ? ` (${facts})` : ''} ${pathWords(x.path)}${r.changed.length > 1 ? ` [from ${x.from.join(', ')}]` : ''}`;
        }),
      ]),
      ...(r.files.length ? [`Files (${r.files.length}):`, ...r.files.map((f) => `  ${f.path}: ${f.records.join(', ')}`)] : []),
      'Purposes:',
      ...listed('Use cases', r.purposes.useCases),
      ...listed('Journeys', r.purposes.journeys),
      ...listed('Business outcomes', r.purposes.outcomes),
      ...(r.purposes.useCases.length + r.purposes.journeys.length + r.purposes.outcomes.length === 0 ? ['  none: no use case reaches these records'] : []),
    ].join('\n'),
};
