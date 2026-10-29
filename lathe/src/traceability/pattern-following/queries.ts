// The Pattern following aggregate's own reads, each answered from its read model (LA-TRC-RM10) through its reader
// (reader.ts): one following whole, and the patterns a domain or use case follows. A handler never sees the data; each
// changes nothing. A following is named by its follower and pattern, so it has no next ID.
import { id, type AnyQuery, type QueryDefinition } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import { PATTERN_FOLLOWING_SLICE } from './model.ts';
import type { FollowingPage } from './read-model.ts';
import { followingReader, type FollowingReader } from './reader.ts';

const refuse = (rule: string, message: string): never => {
  throw new StoreError([{ rule, message }]);
};

/** The following of the pattern by the follower, whole. */
export function getFollowing(reader: FollowingReader, input: { follower_id: string; pattern_id: string }): FollowingPage {
  return reader.following(input.follower_id, input.pattern_id) ?? refuse('missing', `${input.follower_id} does not follow ${input.pattern_id}`);
}

/** GET a following whole (LA-TRC-QRY10). */
export const GET_FOLLOWING: QueryDefinition<{ follower_id: string; pattern_id: string }, FollowingPage, FollowingReader> = {
  id: 'LA-TRC-QRY10',
  slice: PATTERN_FOLLOWING_SLICE,
  name: 'get-following',
  method: 'GET',
  route: '/api/pattern-following/get-following',
  description: "Reads a domain's or use case's following of a pattern whole: the value, or the reason it does not apply, it gives each of the pattern's settings.",
  input: { follower_id: id('The domain or use case.', 'required'), pattern_id: id('The pattern.', 'required') },
  reader: followingReader,
  run: getFollowing,
  text: (f) => [`${f.follower} follows ${f.pattern}`, ...f.settings.map((v) => `  ${v.setting}: ${v.value ?? `not applicable: ${v.notApplicable}`}`)].join('\n'),
};

/** The patterns the domain or use case follows, by ID. */
export function listFollowings(reader: FollowingReader, input: { follower_id: string }): string[] {
  return reader.patternsOf(input.follower_id) ?? refuse('missing', `there is no domain or use case ${input.follower_id}`);
}

/** List the patterns a domain or use case follows (LA-TRC-QRY11). */
export const LIST_FOLLOWINGS: QueryDefinition<{ follower_id: string }, string[], FollowingReader> = {
  id: 'LA-TRC-QRY11',
  slice: PATTERN_FOLLOWING_SLICE,
  name: 'list-followings',
  method: 'GET',
  route: '/api/pattern-following/list-followings',
  description: 'Lists the patterns a domain or use case follows, by ID.',
  input: { follower_id: id('The domain or use case.', 'required') },
  reader: followingReader,
  run: listFollowings,
  text: (patterns) => (patterns.length ? patterns.join('\n') : 'Follows no pattern.'),
};

/** The Pattern following aggregate's queries, as the CLI and the MCP server register them. */
export const PATTERN_FOLLOWING_QUERIES: readonly AnyQuery[] = [GET_FOLLOWING, LIST_FOLLOWINGS];
