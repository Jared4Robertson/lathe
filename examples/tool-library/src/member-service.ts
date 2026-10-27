// Registers members.
// Spec: the command handler TL-LEND-CMD01-H (examples/tool-library/data/).
import type { EventDispatcher } from './events.ts';
import { LendingError, parseEmail, parseName, type Clock, type Member } from './model.ts';
import type { Store } from './store.ts';

export interface RegisterMemberInput {
  name?: unknown;
  email?: unknown;
}

export class MemberService {
  private readonly store: Store;
  private readonly now: Clock;
  private readonly events: EventDispatcher;

  constructor(store: Store, now: Clock, events: EventDispatcher) {
    this.store = store;
    this.now = now;
    this.events = events;
  }

  /** TL-LEND-CMD01-H: register a member. */
  register(input: RegisterMemberInput): Member {
    // TL-VO01-C01, TL-VO02-C01 and C02: a name, and a valid email kept in lower case.
    // TL-PAT-LIBRARIAN-ACTION-R01: missing input is refused, naming it, before anything is saved.
    const name = parseName(input.name);
    const email = parseEmail(input.email);
    if (!name) throw new LendingError(400, 'invalid_request', 'A member needs a name.');
    if (!email) throw new LendingError(400, 'invalid_request', 'A member needs a valid email address.');

    // TL-LEND-INV01: one member per email.
    const member = this.store.transaction(() => {
      if (this.store.findMemberByEmail(email)) {
        throw new LendingError(409, 'email_taken', `A member with the email ${email} is already registered.`);
      }
      return this.store.insertMember(name, email, this.now().toISOString());
    });
    // TL-LEND-EV01: published once the member is committed.
    this.events.publish({ type: 'MemberRegistered', memberId: member.id, name: member.name, email: member.email, joinedAt: member.joinedAt });
    // TL-LEND-UC01-R03: the new member, with its ID, is returned.
    return member;
  }
}
