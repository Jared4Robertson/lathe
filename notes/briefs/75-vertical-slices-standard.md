# Brief: vertical-slice domains as Lathe's standard

Read [00-common-rules.md](00-common-rules.md) and [../plans/vertical-slice-domains.md](../plans/vertical-slice-domains.md) first. Base branch: `main`. Work in your own worktree, and finish with your branch ready to merge.

## Goal
The owner decided that domains are vertical slices of business capability. Each owns its records and rules, views, engine code and tests, and technology is a layer inside a domain's Design stage, never a domain. Make this Lathe's standard for every product it models.

## What to do
1. **FORMAT.md:** a short section on what a domain is. It's a business capability with its own language. Its Define stage holds its domain model and use cases. Its Design stage holds its views, endpoints, components (in layers such as Web app, Engine and Desktop) and tests. What every domain shares goes in a platform domain or a pattern, not in a technology domain. Give one good and one bad example, in general terms and without client names.
2. **A check, `domain-named-for-technology` (severity: warning):** a domain whose title or domain code names a technology layer or delivery channel rather than a capability. That covers words like web app, frontend, front end, backend, back end, API, UI, server, database, desktop, mobile, engine, infrastructure and Electron, matched as whole words in any letter case. The message says what to do: name the capability, and make the technology a layer in each domain. Add it with the standard check header, a fixture and engine tests. A product may allow a domain through a `waive:` field, if one already exists in the meta-model; otherwise don't add a waiver.
3. **The plugin's modeling skill** (`plugin/` model-a-domain or similar): step one, before writing records, finds the business capabilities and makes each one a slice. List the questions that tell a capability from a layer.
4. **Regenerate `lathe/REFERENCE.md`** with `lathe format`.
5. **Specs:** a Checking domain rule and tests for the check, plus an Authoring-style requirement for the guidance. Use the current domains (`LA-CHK` for the check, `LA-MOD` for the format guidance); brief 76 converts them. Use IDs from T680, DR350, C360 and UC130 upward.

## Scope
- **You own:** `lathe/checks/`, `lathe/test/`, `lathe/test/fixtures/`, `lathe/FORMAT.md`, `lathe/REFERENCE.md`, `plugin/`, and your new spec records.
- **Running at the same time:**
  - brief 76, converting `specs/lathe/**`; it merges after you;
  - brief 72, the graph icicle, in `app/src/graph/**`.

## Checks
Run the full checks from the common rules. Then run the new check on Lathe's own spec: it should warn on Browsing ("web app" in its body doesn't count; check the title and code only) and on Desktop. Report what it finds. Run it on the Tool Library too, where it should find nothing. Never use port 5199.

## Report
The branch and its last commit, files changed, decisions made, the checks you ran and their results, and anything left open.
