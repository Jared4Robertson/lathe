// Registers members.
// Spec: TL-LEND-C03 (specs/tool-library/lending/02-design/components/C03-member-service.md)
import { LendingError, type Clock, type Member } from './model.ts';
import type { Store } from './store.ts';

export interface RegisterMemberInput {
  name?: unknown;
  email?: unknown;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class MemberService {
  private readonly store: Store;
  private readonly now: Clock;

  constructor(store: Store, now: Clock) {
    this.store = store;
    this.now = now;
  }

  /** TL-LEND-UC01: register a member. */
  register(input: RegisterMemberInput): Member {
    // TL-LEND-UC01-R01: name and email are required.
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    const rawEmail = typeof input.email === 'string' ? input.email.trim() : '';
    if (!name) throw new LendingError(400, 'invalid_request', 'A member needs a name.');
    if (!EMAIL.test(rawEmail)) throw new LendingError(400, 'invalid_request', 'A member needs a valid email address.');

    // TL-LEND-DR01 / UC01-R02: one member per email, compared without case.
    const email = rawEmail.toLowerCase();
    return this.store.transaction(() => {
      if (this.store.findMemberByEmail(email)) {
        throw new LendingError(409, 'email_taken', `A member with the email ${email} is already registered.`);
      }
      // TL-LEND-UC01-R03: the new member, with its ID, is returned.
      return this.store.insertMember(name, email, this.now().toISOString());
    });
  }
}
