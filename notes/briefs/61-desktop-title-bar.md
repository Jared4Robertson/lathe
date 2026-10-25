# Brief: the desktop title bar is part of the app, as in VS Code

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main`. Work in your own worktree, and finish with your branch ready to merge.

## Goal
In the desktop app (brief 47, `desktop/`), the window has the default macOS title bar ("Lathe, Tool Library — ~/Development/Lathe") on top of the app, so it doesn't look integrated. Jared wants it like VS Code: no system bar, with the traffic lights floating over the app's own bar, which is drawn in the app's colors and carries controls.

## Decisions already made (Jared, and the coordinator's recommendations)
1. **The window** (`desktop/src/main.ts`, `new BrowserWindow`):
   - On macOS, use `titleBarStyle: 'hiddenInset'` (or `'hidden'` with `trafficLightPosition`) so the traffic lights sit vertically centered in a 38 px bar.
   - On Windows and Linux, use `titleBarStyle: 'hidden'` with `titleBarOverlay` (the theme's colors and a 38 px height), so the native window controls draw in the app's colors.
   - Keep `setRepresentedFilename` and the window title, which the Window menu and Mission Control use.
2. **The app draws its own title bar** when `window.latheDesktop?.isDesktop`. It's a new `app/src/shell/DesktopTitleBar.tsx`, mounted with one line at the top of the app shell (`App.tsx`), above the workbench, and spanning the full width.
   - **Height and background:** 38 px, on `--shell`, so the shell and the bar are one surface with no border. Padding leaves room for the traffic lights on macOS (about 78 px) and for the window controls at the right on Windows and Linux (`env(titlebar-area-*)` where it's available, otherwise a constant from the preload's `platform`).
   - **Left:** back and forward icon buttons, following the app's history (disabled at the ends), as in VS Code.
   - **Center, a command center:** a pill showing the product and the current page ("Lathe — Reading the spec"). Clicking it opens quick find, and its tooltip shows the shortcut. It stays centered on the window, not on the leftover space, and truncates with an ellipsis.
   - **Right:** layout toggles for the sidebar (`toggleNav`) and the inspector (`toggleInspector`), as `aria-pressed` icon buttons with tooltips and keys, the same commands as the menus and shortcuts.
   - **Dragging:** the bar is a drag region (`-webkit-app-region: drag`) and its controls are `no-drag`. Double-clicking the empty bar zooms or maximizes the window, following the system setting. This goes through the preload; macOS does it natively with `hiddenInset`.
   - **Tokens only and accessible:** names on every control, focus rings, and hover states (UX-R01, R15, UX-R07).
3. **Follows the theme:** when the theme or the light/dark mode changes (brief 49's ThemeProvider), the app tells the main process through the preload, for example `latheDesktop.setChrome({ background, foreground })`. The main process updates `titleBarOverlay` (Windows and Linux) and `backgroundColor`. Expose only that one method, validate its input in main, and keep the preload tiny.
4. **The page** keeps its layout under the bar. The nav's own search box stays for now.
5. **In a browser** nothing changes: no bar.

## Records (LA-DSK)
- A use case "The desktop window looks like part of Lathe" under `LA-DSK-CAP01`, or requirements under `UC03` (menus) if that fits better, from the next free numbers.
- Domain rules, components (in the right LA-DSK layers, plus the app component in a Browsing layer if it fits better) and tests.
- Tests:
  - the bar renders only when `latheDesktop` is present;
  - back and forward follow history;
  - the command center opens quick find;
  - the toggles run their commands;
  - `setChrome` is called on a theme change, with a valid color;
  - the main process rejects bad colors;
  - the window options per platform (unit-test the options builder).
- Extend the smoke test to check `titleBarStyle`.

## Scope
- **You own:** `desktop/**`, the new `app/src/shell/DesktopTitleBar.tsx` and its styles, the one mount line in `App.tsx`, a small hook into the ThemeProvider for `setChrome` (a few lines), tests, and the records above.
- **Working at the same time:** brief 52 (mobile) is editing `App.tsx` and the shell. Keep your App.tsx change to the mount line, and merge main before reporting.
- Never use port 5199 for anything you start.

## Report
Use the format in 00-common-rules, with your branch and its last commit, and what you saw in the smoke test.
