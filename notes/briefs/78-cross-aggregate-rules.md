# Brief: cross-aggregate domain rules name what they involve

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main`. Work in your own worktree, and finish with your branch ready to merge.

## Goal
A domain rule normally sits on the aggregate, or the entity, it is about. Some hold across aggregates: two records saved together, a selection that depends on another aggregate's state, a lifecycle rule for every record in the domain. S2 has 62 of these out of 354 rules. The meta-model already lets a domain rule sit directly under a domain. The owner decided that such a rule must say which aggregates it ties together.

## What to do
1. **The relation:** add `involves` to `lathe/meta/relations.csv`, from `domain_rule` to `aggregate`. Its labels are "Involves" and "Involved in", and it has no role.
2. **The check, `domain-rule-involves` (warning):** it covers a domain rule whose parent is a domain.
   - It warns when the rule involves fewer than two aggregates, and says to move a one-aggregate rule onto that aggregate.
   - It warns when the rule names an aggregate of another domain. A rule across domains is a domain event's job; say so in the message.
   - A rule under an aggregate or an entity that uses `involves` gets a warning too: its place already says what it's about.
   
   Use the standard check header, with a fixture and engine tests.
3. **FORMAT.md:** update the domain rule text in the domain model section, and regenerate REFERENCE.md. Update the meta-model description of `domain_rule` in `kinds.csv` to mention `involves`.
4. **The app:**
   - The wiki's Traceability section shows the new link both ways. Relation labels come from `relations.csv`, so this may need no code; check it.
   - In the domain's ERD (the Model view), a domain-level rule may be listed in the key or on hover. Only do this if it's small; otherwise list it as open.
5. **The plugin's modeling skill:** one line on when a rule belongs on the domain.
6. **Specs:** a domain rule and tests in Checking (`LA-CHK`), and an edit to the format requirement. Use IDs from T720, DR370 and C380 upward. Brief 76 converts them later.

## Scope
- **Running at the same time:**
  - brief 77 (removing CSV diagrams);
  - brief 76 (the spec conversion, paused for review).
- You own `lathe/meta/relations.csv`, the new check and its tests. Merge main before reporting, and keep both sides.

## Checks
The full checks from the common rules. The UI suites are only needed if the app changes on screen. Never use port 5199.

## Report
The branch and its last commit, files changed, decisions made, the checks you ran and their results, and anything left open.
