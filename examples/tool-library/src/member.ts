// The Member aggregate: a person registered to borrow tools.
// Spec: the aggregate TL-LEND-A1 and its root's data model TL-LEND-EN01-DM (examples/tool-library/data/).
// One member per email (TL-LEND-INV01) is a rule across members, so the aggregate's repository,
// MemberRepository, refuses a taken email, backed by the members table's unique key.

/** A member not saved yet, with no ID. */
export interface NewMember {
  readonly name: string;
  readonly email: string;
  readonly joinedAt: string;
}

/** TL-LEND-EN01-DM: a member, the Member aggregate's root. */
export class Member {
  readonly id: number;
  readonly name: string;
  readonly email: string;
  readonly joinedAt: string;

  constructor(id: number, fields: NewMember) {
    this.id = id;
    this.name = fields.name;
    this.email = fields.email;
    this.joinedAt = fields.joinedAt;
  }

  /** TL-LEND-CMD01: a new member, from a name (TL-VO01) and an email address (TL-VO02) already parsed. */
  static register(name: string, email: string, joinedAt: Date): NewMember {
    return { name, email, joinedAt: joinedAt.toISOString() };
  }
}
