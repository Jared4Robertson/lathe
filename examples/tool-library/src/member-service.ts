// Registers members.
// Spec: the command handler TL-LEND-CMD01-H (examples/tool-library/data/).
import { LendingError, parseEmail, parseName, type Clock, type Member } from './model.ts';
import type { Store } from './store.ts';

export interface RegisterMemberInput {
  name?: unknown;
  email?: unknown;
}

export class MemberService {
  private readonly store: Store;
  private readonly now: Clock;

  constructor(store: Store, now: Clock) {
    this.store = store;
    this.now = now;
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
    return this.store.transaction(() => {
      if (this.store.findMemberByEmail(email)) {
        throw new LendingError(409, 'email_taken', `A member with the email ${email} is already registered.`);
      }
      // TL-LEND-UC01-R03: the new member, with its ID, is returned.
      return this.store.insertMember(name, email, this.now().toISOString());
    });
  }
}
