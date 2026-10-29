// The Member aggregate's command handler.
// Spec: the command handler TL-LEND-CMD01-H (examples/tool-library/data/).
import type { Database } from './database.ts';
import type { Outbox } from './events.ts';
import { Member } from './member.ts';
import type { MemberRepository } from './member-repository.ts';
import { LendingError, parseEmail, parseName, type Clock } from './model.ts';

export interface RegisterMemberInput {
  name?: unknown;
  email?: unknown;
}

/** What registerMember needs: the Member aggregate's repository, the outbox, the clock and the transaction. */
export interface MemberCommandContext {
  db: Database;
  members: MemberRepository;
  outbox: Outbox;
  now: Clock;
}

/** TL-LEND-CMD01-H: register a member. */
export function registerMember(ctx: MemberCommandContext, input: RegisterMemberInput): Member {
  // TL-VO01-C01, TL-VO02-C01 and C02: a name, and a valid email kept in lower case.
  // TL-PAT-LIBRARIAN-ACTION-R01: missing input is refused, naming it, before anything is saved.
  const name = parseName(input.name);
  const email = parseEmail(input.email);
  if (!name) throw new LendingError(400, 'invalid_request', 'A member needs a name.');
  if (!email) throw new LendingError(400, 'invalid_request', 'A member needs a valid email address.');

  const member = ctx.db.transaction(() => {
    // TL-LEND-INV01: the repository refuses a taken email.
    const saved = ctx.members.add(Member.register(name, email, ctx.now()));
    // TL-LEND-EV01, saved to the outbox with the member and relayed once they are committed.
    ctx.outbox.save({ type: 'MemberRegistered', memberId: saved.id, name: saved.name, email: saved.email, joinedAt: saved.joinedAt });
    return saved;
  });
  ctx.outbox.relay();
  // TL-LEND-UC01-R03: the new member, with its ID, is returned.
  return member;
}
