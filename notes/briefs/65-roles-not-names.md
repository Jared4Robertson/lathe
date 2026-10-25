# Brief: specs name roles, not people

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main`. Work in your own worktree, and finish with your branch ready to merge.

## Goal
Jared: "lets not use my name in the specs. Want to be more general."

His name appears 152 times in 103 spec records:
- as the use case actor (`actor: Jared`, `Jared, AI agent`);
- as a question's `owner`;
- in the prose of records and `specs/lathe/product.md`;
- and in a few docs.

Replace it with roles, and add a check that keeps it that way.

## Decisions already made (Jared, and the coordinator's recommendations)
1. **Roles:**
   - **Owner:** the person who decides what a product is for, reviews agents' work and records fitness.
   - **Reader:** anyone using the app to read and navigate a spec, such as a teammate or the owner.
   - **Agent:** an AI agent that writes records and code on someone's behalf. It replaces "AI agent".
   
   Give each use case the role that fits what it does:
   - browsing and reading use cases are Reader;
   - deciding, reviewing and recording fitness are Owner;
   - writing records is Agent, or "Owner, Agent".
   
   Questions' `owner` becomes Owner.
2. **Prose:** rewrite every sentence that names him, using the role ("Jared reads the graph like a folder tree" becomes "The reader reads the graph like a folder tree"), keeping the meaning. `specs/lathe/product.md`'s actors paragraph defines the three roles and keeps the foundation idea: an agent is a Tool acting for a Person, so every agent action traces back to the owner.
3. **Roles as data:**
   - Add a header field `actors: Owner Reader Agent` to `specs/lathe/product.md`, and `actors: Librarian Member` (or whatever the Tool Library's use cases name) to the Tool Library's product record.
   - Add Lathe's house check `lathe-checks/02-actor-not-a-role.sql` (warning; the standard header, with `kinds: use_case`). It fires when a use case's `actor` names anything (split on commas) that isn't in its product's `actors`, and on a product with use cases but no `actors`.
   - If this would help any product, propose it as a Lathe check instead, in your report, but don't build it in `lathe/`.
4. **Docs:**
   - Replace his name in `lathe/README.md`, the root `README.md` and `plugin/skills/extend-the-meta-model/SKILL.md` where it describes a person's role, using "the owner".
   - Keep the npm scope `@jaredrob/lathe`, the plugin author fields in `plugin/.claude-plugin/*.json`, and anything in `desktop/src` that is a path or an example; just list them.
   - Leave `notes/` (briefs, trials, design notes) and `NOTES.md` alone: they record his decisions.
5. **The agent rules:** add to `notes/briefs/00-common-rules.md` the line "Specs name roles (Owner, Reader, Agent), never people".
6. **Fixtures:** check the app and engine test fixtures and tests that assert "Jared". Update them to the roles unless the test is about arbitrary actor text, in which case keep a neutral name such as "Shopper".

## Checks
- `npm --prefix lathe run check`: 0 errors and no `actor-not-a-role` warnings.
- `grep -rni "jared" specs` finds nothing.
- Run the full checks.

## Scope
- **You own:** text replacements in `specs/**`, the two product records' `actors` field, `lathe-checks/02-…`, the docs and the agent rules line named above, and the test expectations that change.
- **Working at the same time:** briefs 51, 53 and 62 may add records. They've been told to use roles. Before you report, merge `main` in and replace any new mentions.

## Report
Use the format in 00-common-rules, with your branch and its last commit, the role chosen for each use case (a table), and the list of names kept on purpose.
