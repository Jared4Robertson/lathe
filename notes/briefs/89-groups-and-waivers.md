# Brief: requirement and pattern-rule groups; waivers by setting value

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main`. Work in your own worktree, and finish with your branch ready to merge. Source: notes/trials/s2-trial-4.md, sections 4.1 and 4.8 (findings only; never copy client text).

## Decisions (made by the coordinator on the owner's standing instruction; apply them)
1. **Groups.** An optional `group` field on `requirement`, `interaction_requirement` and `pattern_rule`: a short heading such as "Validation" or "Paging".
   - The wiki shows a use case's requirements, and a pattern's rules, under their group headings, in the order each group first appears. Ungrouped items come first, without a heading.
   - The Outline in the side bar lists the groups.
   - The `too-many-children` check counts children per group, as it counts flow steps per path.
   - A group with one member gets the `lone-child` warning, like a layer.
2. **Waivers by setting value.** An optional `applies_when` field on `pattern_rule`, written as `<setting> is <value>` or `<setting> is not <value>`, with values compared trimmed and in any letter case.
   - In a domain, a rule is owed only when at least one following use case (or the domain itself) gives settings that satisfy it. Otherwise it's waived: neither owed nor proved, as S2 counts it. This works alongside today's rule that a setting given as Not applicable waives the rules naming it.
   - New check `applies-when-unknown` (error): the field names a setting the pattern doesn't have, or is malformed.
   - The wiki shows a waived rule as "Waived here: <setting> is <value>", and the Traceability gaps leave it out.
3. **Dogfood:**
   - Group Lathe's own requirements where a use case has more than about 8. The largest are probably the graph use case and the views use case.
   - Group the App code and App experience patterns' rules where it reads better.
   - Add one `applies_when` to the Tool Library example, so it has a real use.

## Scope
`lathe/meta/kinds.csv` (fields), the checks, `lathe/src` (coverage), the wiki and side bar in the app, FORMAT.md and REFERENCE.md, the plugin's modeling skill, and specs in Authoring (format), Traceability (waived coverage) and Exploring (display). Use IDs that continue from the highest in each kind per slice. Briefs 90 and 91 run alongside and also touch `kinds.csv`, `relations.csv` and FORMAT.md; merge main before reporting and keep both sides.

## Checks
The full checks, plus the stability and a11y suites, once each with one worker. Gate on real exit codes. Never use port 5199.

## Report
The branch and its last commit, what changed, the dogfood edits, the checks you ran and their results, and anything left open.
