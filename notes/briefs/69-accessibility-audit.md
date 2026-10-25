# Brief: an automated accessibility audit, fixed and guarded

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main`, after brief 53 phase 1 (the Playwright stability suite) has merged. Work in your own worktree, and finish with your branch ready to merge.

## Goal
Lathe has accessibility rules: accessible names, focus rings, keyboard paths, contrast, touch targets. But nothing audits whole rendered pages. Add an automated audit, fix what it finds, and keep it clean.

## What to do
1. **Add the audit:** axe-core (`@axe-core/playwright`, a dev dependency in `app/`) runs inside brief 53's Playwright suite on every page and state the suite visits, at desktop and phone widths, in light and dark and in the High contrast theme:
   - product, domain and record pages;
   - groups;
   - the graph and the Model view;
   - Checks, Format and Appearance;
   - quick find, the palette, the shortcuts sheet;
   - the inspector or side bar;
   - the mobile sheets.
   
   Script: `npm --prefix app run test:a11y`, at WCAG 2.2 AA.
2. **Catalog the findings** in `notes/a11y-audit.md`, grouped by rule, with each finding's cause and fix. Fix them by cause across the app, as brief 53 did for jitter.
3. **Check what axe can't:**
   - keyboard paths (every control reachable and operable, with no traps);
   - focus order after navigation and when sheets and dialogs close;
   - live announcements (the existing announcer).
   
   Add Playwright keyboard scenarios for the main tasks: open a record, switch views, re-center the graph, fold rows, open and close the inspector, and pick a theme.
4. **Guard it:** add a rule to the App experience pattern (`LA-PAT-APP-UX`, the next free number, or to App code if brief 63 hasn't landed), "Every page passes the accessibility audit". Run the suite with the stability suite for UI changes, and note it in 00-common-rules.

## Records
A Browsing use case or requirement ("Use Lathe with a keyboard and a screen reader"), with domain rules, components and tests from the next free numbers.

## Scope
- **You own:** the a11y suite, the fixes across `app/src/**` (keep each small), `notes/a11y-audit.md`, the rule, and the records above.
- Check which agents are running when you start, and stay out of their files beyond small fixes; list any you couldn't make.
- Never use port 5199.

## Report
Use the format in 00-common-rules, with your branch and its last commit, and the findings before and after.
