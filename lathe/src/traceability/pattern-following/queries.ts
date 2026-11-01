// The Pattern following aggregate's own reads, each answered from its read model (LA-TRC-RM10) through its reader
// (reader.ts): one following whole, the patterns a domain or use case follows, and a pattern's followers by domain. A handler never sees the data; each
// changes nothing. A following is named by its follower and pattern, so it has no next ID.
import { id, type QueryDefinition } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { FollowingPage, PatternFollowers } from './read-model.ts';
import { followingReader, type FollowingReader } from './reader.ts';
import { GET_FOLLOWING_IDENTITY, LIST_FOLLOWINGS_IDENTITY, LIST_FOLLOWERS_IDENTITY } from './queries.generated.ts';

const refuse = (rule: string, message: string): never => {
  throw new StoreError([{ rule, message }]);
};

/** The lines of a following's settings, each with its value. */
const settingLines = (f: FollowingPage, indent: string) => f.settings.map((v) => `${indent}${v.setting}: ${v.value}`);

/** The following of the pattern by the follower, whole. */
export function getFollowing(reader: FollowingReader, input: { follower_id: string; pattern_id: string }): FollowingPage {
  return reader.following(input.follower_id, input.pattern_id) ?? refuse('missing', `${input.follower_id} does not follow ${input.pattern_id}`);
}

/** GET a following whole (LA-TRC-QRY10). */
export const GET_FOLLOWING: QueryDefinition<{ follower_id: string; pattern_id: string }, FollowingPage, FollowingReader> = {
  ...GET_FOLLOWING_IDENTITY,
  input: { follower_id: id('The domain or use case.', 'required'), pattern_id: id('The pattern.', 'required') },
  reader: followingReader,
  run: getFollowing,
  text: (f) => [`${f.follower} follows ${f.pattern}`, ...settingLines(f, '  ')].join('\n'),
};

/** The patterns the domain or use case follows, by ID. */
export function listFollowings(reader: FollowingReader, input: { follower_id: string }): string[] {
  return reader.patternsOf(input.follower_id) ?? refuse('missing', `there is no domain or use case ${input.follower_id}`);
}

/** List the patterns a domain or use case follows (LA-TRC-QRY11). */
export const LIST_FOLLOWINGS: QueryDefinition<{ follower_id: string }, string[], FollowingReader> = {
  ...LIST_FOLLOWINGS_IDENTITY,
  input: { follower_id: id('The domain or use case.', 'required') },
  reader: followingReader,
  run: listFollowings,
  text: (patterns) => (patterns.length ? patterns.join('\n') : 'Follows no pattern.'),
};

/** The pattern's followers by domain: whether each domain follows it itself, and each of its use cases that does. */
export function listFollowers(reader: FollowingReader, input: { pattern_id: string }): PatternFollowers {
  return reader.followersOf(input.pattern_id) ?? refuse('missing', `there is no pattern ${input.pattern_id}`);
}

/** List a pattern's followers (LA-TRC-QRY14). */
export const LIST_FOLLOWERS: QueryDefinition<{ pattern_id: string }, PatternFollowers, FollowingReader> = {
  ...LIST_FOLLOWERS_IDENTITY,
  input: { pattern_id: id('The pattern.', 'required') },
  reader: followingReader,
  run: listFollowers,
  text: (f) =>
    f.domains.length === 0
      ? `Nobody follows ${f.pattern}.`
      : f.domains
          .flatMap((d) => [
            `${d.domain}${d.itself ? ' (follows it itself)' : ''}`,
            ...(d.itself ? settingLines(d.itself, '    ') : []),
            ...d.useCases.flatMap((uc) => [`  ${uc.follower}`, ...settingLines(uc, '    ')]),
          ])
          .join('\n'),
};
