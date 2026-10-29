// Loads and saves the Member aggregate, whole, in the members table.
// Spec: the repository TL-LEND-REPO01 (examples/tool-library/data/).
import type { Database, Row } from './database.ts';
import { LendingError } from './model.ts';
import { Member, type NewMember } from './member.ts';

function toMember(r: Row): Member {
  return new Member(Number(r.id), { name: String(r.name), email: String(r.email), joinedAt: String(r.joined_at) });
}

/** TL-LEND-REPO01: the Member aggregate's repository. */
export class MemberRepository {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Saves a new member and returns it as stored. TL-LEND-INV01: one member per email, so a taken email is
   * refused; the table's unique key backs it up.
   */
  add(member: NewMember): Member {
    if (this.db.sqlite.prepare('SELECT 1 FROM members WHERE email = ?').get(member.email)) {
      throw new LendingError(409, 'email_taken', `A member with the email ${member.email} is already registered.`);
    }
    const r = this.db.sqlite
      .prepare('INSERT INTO members (name, email, joined_at) VALUES (?, ?, ?) RETURNING *')
      .get(member.name, member.email, member.joinedAt) as Row;
    return toMember(r);
  }

  /** The member with this ID; 404 `member_not_found` when there is none. */
  get(id: number): Member {
    const r = this.db.sqlite.prepare('SELECT * FROM members WHERE id = ?').get(id) as Row | undefined;
    if (!r) throw new LendingError(404, 'member_not_found', `There is no member ${id}.`);
    return toMember(r);
  }
}
