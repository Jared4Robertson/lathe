# Overnight log (2026-10-24 into 10-25)

Jared asked the coordinator to go with its recommendation on any blocker and check back in the morning. This log records each merge, each agent started, and every decision taken without him, for his review.

## Night two (2026-10-25 into 10-26)
Jared, going to bed: "Please make any decisions needed in order to complete the pending work." The coordinator took the recommended option on every pending decision.

**Decisions taken without Jared:**
- **The S2 trial-4 additions,** each as previously recommended:
  - `group` on requirements and pattern rules (brief 89);
  - waivers as `applies_when` on a pattern rule, compared against setting values (89);
  - default `api` and `integration` kinds (90);
  - technical flows as `design_flow` with `design_step` (90);
  - engineering standards as `standard`, `standard_rule` and `meets`, owing no coverage (91);
  - relationship detail stays later, as recommended.
- **App code and App experience stay patterns, not standards:** their rules are proved by tests. The rule of thumb is that a rule proved with tests is a pattern rule, and a rule followed and cited is a standard rule.
- **Graph shapes:** the proposed set for every kind (brief 88), queued after brief 87.
  - In Tree, the outline is the shape.
  - In Nested and Voronoi, the shape is a small mark in the header.
  - The Model view's events become flags to match.
- **Text per level in Nested and Voronoi** (brief 87): a 1.5× step per level, with boxes sized from the leaves up to fit.

**Running at 00:05:** 87 (text per level), 89 (groups and waivers), 90 (API, integration and technical flows), 91 (standards). Brief 88 (shapes) starts when 87 merges.

**Merges and calls since:**
- 00:27 `33ce118` Engineering standards (91):
  - `standard`, `standard_rule` and `meets`, owing no coverage;
  - the `standard-rule-unmet` warning;
  - FORMAT section 20;
  - the dogfood standard `LA-STD-CODE`, three rules checked against the code.
  
  App 337, engine 266, check 0 errors; stability 43, a11y 125.
- 00:30 Text per level (87), first pass, **not merged**: with a fixed 1.5× step the upper titles were tiny against their boxes. Sent back to take the scale from each level's typical box size.
- 00:55 Text per level (87), second pass: one size per level from the top fails. Lathe has leaves high up (24 pattern rules under Shared) that would get huge text and inflate the map. **Decision:** levels are counted from the leaves up. A leaf is level 0, and a parent is one more than its tallest child, so every record reads at leaf size wherever it sits. Sent back with that rule. The 16 px stability check stays.

## Where things stand (03:05)
All queued briefs are merged into local `main`. Nothing is pushed. No agents are running.
- **Your dev server on port 5199 needs a restart** (`npm --prefix app run dev`). It has been up since before the moves, and its hot reload is broken.
- **Decided by Jared:** keep the depth-3 re-center budgets as set: a longest frame under 100 ms, under 500 ms of work, and at most 3 frames over 20 ms.
- **Please decide:** the six trial-4 additions below.
- **Please check by hand:** the desktop title bar and icon in a real window, and the Dock badge in a packed app.
- **Left open on purpose:** a page tab could announce its Delete shortcut, but that clashes with the keep-tab hint in the tooltip.

## Plan
1. Merge each agent as it reports: check its report, run the combined tests on `main`, and look at UI changes in the browser. Never push.
2. Start queued briefs as they unblock, at most about five agents at once:
   1. When jitter phase 1 (53) merges: the pattern split (63), then jitter phase 2 (53), ghost buttons (54), Traceability (57b) and graph depth with the context ring (56).
   2. Then bare-ID addresses (55), event display (60) and the side bar (64).
3. Folded-in follow-ups:
   - phone record rows stack the ID above the title (jitter phase 2);
   - tab commands in the desktop menus (brief 62).

## Work added on the coordinator's own initiative (Jared: "if there's any more work... please do it")
- 66: prove the Tool Library's body limit (TL-LEND-E06-R03), the last standing warning. Started.
- 67: S2 trial 4, to measure how close Lathe now is to S2's organization; findings only, in notes/trials/. Started.
- 68: docs and plugin refresh, so they describe today's Lathe. Queued after 65.
- 69: an automated accessibility audit (axe in the Playwright suite), with fixes and a new rule. Queued after 53 phase 1.
- 70: performance budgets (engine load, bundle, interactions), with fixes and a new rule. Queued after 56.

## Desktop app management (Jared asked: manage it, quit heavy instances, fix issues)
- 23:57 — "Electron unexpectedly quit while reopening windows" prompts: caused by agents' smoke tests launching and killing the dev Electron. Fix sent to brief 62: opt out of macOS window restoration in the app, and have tests quit Electron gracefully with a teardown. Until it lands, the other agents skip the smoke test. One idle test Electron (from agent 65's worktree) was running at 0% CPU, so it was left alone.

## Decisions taken without Jared
- 00:00 — Held the docs refresh (68) while load was near 10, rather than start a sixth agent.
- 00:00 — Resolved the F02 merge conflict between the roles change (65) and the format pages (51) by keeping both: roles wording, plus the new format-reference step.
- 00:00 — Fixed the leftover names myself (the sample workspace's question owner, and two desktop comments): small and text-only.

## For Jared in the morning: decisions from S2 trial 4 (notes/trials/s2-trial-4.md)
Lathe now matches S2 on UC requirements (206/206) and domain rules (98/98) across three whole S2 domains. The scorecard rose in every area but two: test plan and standards stayed at 3. The clear, small fixes are under way as brief 71: `supports`, flow `path`, `key_file`, the "Business meaning" alias, domain rules under entities, and nested layers. The test plan grouping fix is folded into 57b. These larger additions change Lathe's shape and need your call:
1. **Technical flows** (`design_flow` with ordered steps that use and satisfy). Size L. They remove 12 false `unsatisfied` warnings, and give S2's "how it runs" flows a home. Recommended: yes.
2. **API and integration kinds** as defaults (an API file grouping endpoints, and an outside system). Size S. Recommended: yes.
3. **Waivers:** a pattern rule that doesn't apply because of a setting's value, not only N/A. Size S to M. Recommended: yes, as `applies_when` on the rule.
4. **Engineering standards** (`standard` and `standard_rule` at product level, like S2's STD rules). Size M. They'd also be a home for Lathe's own App code and App experience patterns. Recommended: yes, and consider moving those patterns to standards.
5. **Relationship detail** (a verb, an optional end, several links per pair, from a Relationships table). Size M. Recommended: later.
6. **Requirement and pattern-rule groups** (a `group` field shown as sub-headings). Size S. Recommended: yes.

## More merges
- 00:12 `a4b2783` S2 trial 4 findings (67): notes/trials/s2-trial-4.md.
- 00:15 `392e3c0` Jitter phase 1 (53): a 31-scenario stability suite (`npm --prefix app run test:stability`); the graph and ERD jumps fixed (ERD aggregate to entity: CLS 0.11 to 0). It passes on main, run by the coordinator.
- 00:17 `6262c88` Docs and plugin refresh (68): root, lathe and desktop READMEs; plugin 0.4.0; every documented command run; two doc bugs fixed.

- 00:24 `cd11fd9` Pattern split (63): App code keeps 9 coding rules, and the new App experience pattern (`LA-PAT-APP-UX`) takes 8 behavior rules. 17/17 proved, and the size warning is gone.
- 00:25 Started jitter phase 2 (with self-hosted fonts and phone rows), Traceability (57b, with test-plan groups) and the graph depth and context ring (56). Ghost buttons (54) and the accessibility audit (69) wait, since they touch every call site.

- 00:44 `c8c5598` Trial-4 fixes (71): `supports`, flow paths, `key_file`, the Business meaning alias, rules under entities and nested layers. On the three S2 roots, false errors went 82 → 0 and warnings 394 → 317. Engine 265 passed.
- 00:48 `218dcef` (coordinator) `too-many-children` counts a flow's steps per path, as brief 71 left open. LA-CHK-UC23-R05 and T333; engine 266 passed.
- The app-side follow-ups from 71 (path tables, Supported by, nesting in the folder model) went to the Traceability agent (57b).

- 01:15 `3b254b5` Traceability section (57b):
  - Designed by, Proved by, Supported by and Carried out in, with gap callouts linking to checks;
  - a use case's requirement table;
  - relation labels everywhere (DR243);
  - test plan groups (UI tests and Design checks);
  - flow path tables and nested layers.
  
  App 263 passed.
- 01:17 (coordinator) Split the Page aggregate: the new Record content aggregate (LA-BRW-A11) takes 8 rules, and A1 keeps 11. The size warning is gone. The graph agent was asked to split the Graph layer (LAY07, 16 components) into sub-layers.
- 01:18 Started ghost buttons (54).

- 01:00 `33de994` Jitter phase 2: every stability scenario is at 0 unexpected shift with the nav and tabs counted.
  - Nav rows stay still unless you navigate in the nav.
  - Every tab is the same width.
  - Back restores the scroll position.
  - Scroll boxes keep a scrollbar gutter.
  - Fonts are self-hosted (OFL, offline-ready).
  - Phone rows put the ID above the title.
  - The inspector's gaps use the wiki's words.
  
  App 265 passed.
- 01:00 (coordinator) The server sends the fonts as `font/woff2`, and F04 carries out UC117. Warnings are down to 8: seven `event-unheard`, by design, and the Graph layer split, which is in progress.
- 01:01 Started the accessibility audit (69). Load was 12, but from macOS `mediaanalysisd` (about 2.6 cores, system), not Lathe; it was left alone.

- 01:20 `b9f901c` Ghost buttons (54): one Button component (ghost, primary, icon); every standalone action uses it; UX-R09. App 267 passed. Follow-up running: the icon buttons in views and shell.
- 01:21 Started bare-ID addresses (55).

- 01:45 Icon buttons in views and shell now use the shared Button (15 call sites), and the R09 test fails on any new raw icon button.

- 01:40 `c5719fe` Graph (56):
  - the graph's tree is the nav's tree (Define and Design, then folders), with folders as levels;
  - depth means levels;
  - the Links switch;
  - the context ring, spotlight, "+N more" chips, edge hints, minimap and step keys (Alt+arrows);
  - the ERD ring.
  
  The Graph layer is split into 3 sub-layers. App 281 passed. Not met: the frame budget at depth 3 (worst frame 450 ms); that goes to performance (70). One flaky stability step: ERD Back.
- 01:44 (coordinator) `82c46aa` Stage and folder pages say "Define", not "Defines"; tabs keep the Links, context-ring and minimap switches (T554, T555).
- 01:45 Started event display (60) and the side bar (64). Performance (70) waits for 60 (both touch graph and model).
- 01:36 `84c8af7` Bare-ID addresses (55):
  - records, products and domains live at `/<ID>`, and groups at `/<parent>/<stage>/<folder>`;
  - every old `/records`, `/specs` and `/graph` address redirects;
  - saved tabs are converted;
  - a product or domain has one page;
  - CODE-R19.
  
  App 287, engine 266, check 0 errors and 7 warnings. Checked in the browser on a fresh server.
- 01:40 **Your dev server on 5199** has been up for 6 hours. Its hot reload broke on files that were moved (it still asks for `src/specs/FormatPage.tsx`), and the graph stays on "Loading". Restart it (`npm --prefix app run dev`). I left it running because it's yours.
- 01:42 `04e4bb3` Domain events (60):
  - an aggregate's ERD shows its events as spark pills, with a raised-by line and dashed reacts-to lines to the faded reacting aggregates;
  - a domain's ERD shows cause and effect between aggregates;
  - the wiki has a Domain events list;
  - the graph styles events.
  
  App 292 passed; check 0 errors.
- 01:45 (coordinator) `e91e91b` Event pages offer the Model view, with the pill picked out (UC113-R07 is now a MUST, T556). Checked in the browser.
- 01:46 Started performance (70). It also has the first ERD layout: 10–18 s on a fresh dev server while load was high.
- Load reached 50 at 01:40, from macOS `mediaanalysisd` plus test runs. It dropped when they finished.
- 02:02 `001cdde` Secondary side bar (64): the inspector is now a side bar with Details, Outline and History.
  - It's closed in the Wiki view and open in Graph and Model.
  - Details follows the hover and the selection.
  - Outline lists headings, levels or boxes.
  - History shows commits and diffs from `GET /api/history`: git runs from an argument array, with no shell, `--no-ext-diff`, a 5-second limit and a 512 KB cap.
  
  App 298, engine 270, check 0 errors. Checked in the browser (Details and History).
- 02:27 `5229966` Performance budgets (70):
  - the first load dropped from 658 to 170 KB gzipped;
  - ELK runs in a web worker;
  - a depth-3 re-center went from a longest frame of 517 ms and 1135 ms of work to 78 ms and 387 ms. **The budgets were changed** to a longest frame under 100 ms, under 500 ms of work and at most 3 frames over 20 ms: the 320 ms glide over up to 200 boxes can't fit 100 ms. Confirmed by Jared;
  - the engine's cold load went from 469 to 254 ms, and a reload from 444 to 176 ms (parse cache, checks run side by side);
  - the flaky ERD Back step was a measuring bug, now fixed without loosening the limit;
  - UX-R30.
  
  App 299, engine 272, check 0 errors. Graph, Model and diagrams checked in the browser.
- 02:30 (coordinator) The common rules add `test:perf` to the full checks for loading and graph changes; the jitter audit records the measurement fix.
- 02:58 `a7350d2` Accessibility audit (69):
  - axe-core at WCAG 2.2 AA over 100 page states, plus 9 keyboard scenarios (`npm --prefix app run test:a11y`);
  - findings went from failures in 94 of 100 states to 0;
  - fixed: control names, the tab's close button no longer inside the tab, 24 px targets, keyboard-reachable scroll boxes, the contrast in Checks and Appearance (no token changed), first-load focus;
  - UX-R10 and UC120.
- 03:00 (coordinator) `5084a6c` The performance rule is now UX-R11, after R10; it was R30.
- 03:05 (coordinator) `162c09a` The graph's trail is a Tab stop only while it overflows (T624), left open by 69. App 300, engine 272, check 0 errors.

## Incident
- During 57b, the agent stopped "the process on its dev port" and killed pid 77501, the **Claude desktop app's network service**, which had a connection open to that port. Electron restarted the service; the app and the in-app browser were checked and work. New agent rule: stop only processes you started, by recorded PID, never by port or name. If anything in the Claude app seemed off around 01:00, this is why; a restart of the app clears it.

## Decisions taken without Jared (continued)
- 00:12 — Started brief 71 (the small, clear trial-4 fixes). The larger trial-4 additions are listed above for Jared.
- 00:17 — Jitter phase 2 will self-host the fonts (Archivo, Public Sans and JetBrains Mono, all under the OFL), with `font-display: optional`. The agent asked first because it adds font files to the repo. Recommended: yes. It removes the dependency on Google Fonts, works offline in the desktop app, and stops the font swap from shifting the page.
- 00:17 — Running the pattern split (63) first and alone, since it renames rule IDs everywhere; the other UI briefs follow when it lands.

## Lessons
- Never pipe a merge into `tail`: its exit status hid a merge conflict, and the worktree was removed before the conflict was resolved. The branch was intact, and the conflict was fixed. Merges now run unpiped, inside an `if`.

## Merges
- 23:59 `5c0e1f5` Format reference pages (51): a page per kind and check, with contextual links. App 246 passed; checked in the browser.
- 00:00 `a496655` Roles, not names (65): no names in specs, plus the actor-not-a-role house check.
- 00:00 `5a60433` Tool Library body limit proved (66). The old limit sent a reset instead of the 413; fixed. The unproved warning is gone.
- 00:01 `a2792d1` Leftover names in the sample workspace and desktop comments.
- 00:04 `1800718` Desktop polish (62), covering:
  - a new icon, with a DEV variant;
  - a Dock badge for errors, and a Dock menu;
  - About, Settings (Cmd+,) and editor choice;
  - Reveal, Open in editor and Copy ID on records;
  - one running app at a time;
  - launch and error pages;
  - tab commands in the menus, with Ctrl+Tab working.
  
  The restore prompt is fixed: `ApplePersistenceIgnoreState` is set, and tests quit Electron gracefully. App 250 and desktop 61 unit tests passed.
