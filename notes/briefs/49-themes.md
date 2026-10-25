# Brief: themes, built in and custom

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main`. Work in your own worktree, and finish with your branch ready to merge.

## Goal
Jared wants to pick from a few built-in themes and create his own: colors, plus anything else that belongs with a theme. Every visual value is already a token in `:root` in `app/src/styles.css`. Rule `LA-PAT-APP-CODE-R03` keeps colors in tokens, and the dark values sit under `prefers-color-scheme`. So a theme is a named set of token values.

## Decisions already made (Jared, and the coordinator's recommendations)
1. **What a theme sets** (only tokens; no theme touches a selector):
   - **Colors:**
     - surfaces: `--shell`, `--paper`, `--sheet`;
     - text: `--ink`, `--muted`;
     - borders: `--rule`;
     - accent: `--steel` and `--steel-bg`, and the hover tint and ring derived from them;
     - `--spark` and `--warn`, plus errors;
     - the graph stage colors `--g-*`, and the ERD colors from brief 45 if it has landed;
     - shadows, the backdrop, and `--on-mark`.
   - **Typography:** `--display`, `--body`, `--mono`, and a new `--text-size` base (the body's 15px today), with sizes that scale from it where they're absolute today.
   - **Shape and density:** `--panel-radius`, `--panel-gap`, and a new density setting (comfortable or compact) driving row padding and line height through tokens.
   - **Motion:** follow the system, or always reduced, read with R12's motion tokens.
   - **Light and dark:** every theme has a light set and a dark set. The person chooses System (the default), Light or Dark, as now through `prefers-color-scheme`, but chosen in the app.
2. **Built-in themes, five original palettes.** Use no brand names and copy no well-known palette.
   - **Lathe:** today's tokens, unchanged.
   - **High contrast:** stronger borders and text, aiming for WCAG AAA (7:1) for body text in both modes.
   - **Workshop:** warm paper and wood tones, with a rust accent.
   - **Midnight:** a deep blue-black, with a cyan accent. Its light mode is a cool pale.
   - **Graphite:** neutral grays, with one accent.
3. **Picking a theme:**
   - **The command:** "Color theme" (`chooseTheme`, Cmd+K then Cmd+T, as in VS Code; check that the chord fits the keymap's rules) opens a quick-pick list.
   - **Previewing:** arrowing through the list previews each theme live. Enter keeps it, and Escape restores the one before.
   - **The mode switch:** a "Light, dark or system" switch command, and the same choice on the Appearance page.
4. **The Appearance page** (`/settings/appearance`, linked from the nav footer and the palette):
   - It lists the themes with small previews.
   - "Duplicate and edit" opens an editor:
     - color pickers grouped by purpose, with the light and dark sets side by side;
     - font choices from a short safe list, plus custom font stacks;
     - text size, density, radius, gap and motion;
     - a live preview of the app around it;
     - rename, delete and reset.
   - **Contrast warnings:** text below WCAG AA contrast (4.5:1 for text, 3:1 for large text and controls) gets a warning beside its swatch while editing.
5. **Storage:** custom themes and the chosen theme are kept per person in local storage. Export and import as a JSON file (a small, versioned schema), so a theme can be shared or kept in a repo. The desktop app (brief 47) can store them in its user data later; leave a seam for that.
6. **No flash:** apply the chosen theme before first paint, with a small inline script in `app/index.html` that reads storage and sets the tokens and the mode on `<html>`. A theme switch applies instantly, without a reload.
7. **Proactive standard:** add `LA-PAT-APP-CODE-R15`, "Themes only set tokens". Brief 41 (tabs) takes R14, and brief 48 R13.
   - Every visual value comes from a token. A theme is data that sets tokens only.
   - Every built-in theme passes WCAG AA for text and controls in both modes.
   - Prove it in `app/test/standards.test.tsx`: compute the contrast of `--ink`, `--muted` and the accent on `--paper` and `--sheet` for every built-in theme and mode, and check that a theme file holds token names only.

## Records
- Use case `LA-BRW-UC114` "Choose and make a theme" under `LA-BRW-CAP02`, with requirements.
- Domain rules from `LA-BRW-DR200`, components from `LA-BRW-C190` (a new layer `Theming`, or `LAY08`) and tests from `LA-BRW-T420`. Add the use case to a flow's `carries_out`.
- R15 goes in the App code pattern.

## Scope
- **You own:** `app/src/theme/**` (new), the token and theme parts of `app/src/styles.css`, `app/index.html` (the early theme script), the Appearance route and page, the theme commands (merge with the keymap changes from brief 45), `app/test/**` for your tests, and the records above.
- **Working at the same time:**
  - Brief 45 (the Model view, panes and new shortcuts: `app/src/views/**`, `app/src/model/**`, `app/src/shell/keymap.ts`).
  - Brief 47 (`desktop/**`).
  - Brief 48 (clickable rows: `app/src/components/**`, `app/src/specs/parts.tsx`, row styles).
  - Before you report, merge `main` in, keep both sides, and rerun the full checks.
- Never use port 5199. Use `npx vite --port 5412` in `app/` and stop it.

## Report
Use the format in 00-common-rules, with your branch and its last commit, and the contrast numbers for each built-in theme.
