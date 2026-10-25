# Brief: split App code into App code and App experience

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main`, after brief 53 phase 1 (it adds R17) has merged. Work in your own worktree, and finish with your branch ready to merge.

## Goal
`LA-PAT-APP-CODE` now has 16 or more rules, and `too-many-children` warns past 15. Jared decided to split it in two by theme, not to raise the limit.

## The mapping (decided)
**`LA-PAT-APP-CODE` "App code" keeps its IDs:**
- R01 layout in markup
- R02 style by class
- R03 tokens
- R04 generic components
- R05 plural and lowerLabel
- R06 accessible names
- R07 American spelling
- R10 grid columns
- R15 themes set tokens

New coding rules continue from **R19**. Brief 55 adds R19, "One address per thing", whose `addressOf` part is code. Numbers are never reused.

**The new `LA-PAT-APP-UX` "App experience"**, in `specs/lathe/patterns/PAT-app-ux.md` and `PAT-app-ux/`, takes the behavior rules with new IDs:
- UX-R01 everything clickable shows a hover state (was CODE-R08)
- UX-R02 the workbench (was CODE-R09)
- UX-R03 the page bar and pane headers (was CODE-R11)
- UX-R04 motion is shared and optional (was CODE-R12)
- UX-R05 a row or card that leads to one record is one link (was CODE-R13)
- UX-R06 every open thing has an address (was CODE-R14)
- UX-R07 everything works by touch (was CODE-R16)
- UX-R08 nothing jumps (was CODE-R17)
- New behavior rules continue from UX-R09. Brief 54's "Actions look like actions" becomes UX-R09.

## What to do
1. Create the UX pattern record (a body saying what it covers, with the rules list) and its rule records, moving each rule's text across with its new ID. Delete the moved CODE rule files.
2. LA-BRW follows both patterns: add `LA-PAT-APP-UX` to `specs/lathe/browsing/domain.md`'s `follows`.
3. Replace every citation of a moved ID across the repo with its new ID:
   - test `proves` links;
   - spec record prose and mentions;
   - test names in `app/test/**`;
   - comments in `app/src/**` and `styles.css`;
   - `notes/briefs/*` that are still queued (54, 55, 56, 57b, 60, 61, 62);
   - `notes/mobile-design.md` and `notes/jitter-audit.md`;
   - the plugin docs and README.
   
   Use a script with the exact mapping, then check with `grep -rn "LA-PAT-APP-CODE-R\(08\|09\|11\|12\|13\|14\|16\|17\)"` that nothing is left.
4. Update `PAT-app-code.md`'s rules list, and its body: what "App code" covers now, with a pointer to App experience.
5. Spec check: 0 errors, and no `too-many-children` warning on either pattern. LA-BRW's pattern rule coverage shows both patterns fully proved.

## Scope
- **You own:** the pattern records, and the ID replacements across the repo (text-only changes in any file).
- Check which agents are running when you start. If an agent's branch still cites the old IDs, tell the coordinator in your report, so they can be told to merge main.

## Report
Use the format in 00-common-rules, with your branch and its last commit, and the count of replacements per file.
