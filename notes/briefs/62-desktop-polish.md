# Brief: polish the desktop app

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main`, after brief 61 (the title bar) has merged, since both work in `desktop/`. Work in your own worktree, and finish with your branch ready to merge.

## Goal
Jared: "Can we polish the electron app in other ways as well. Icon, etc." The shell (brief 47) works, and brief 61 integrates the title bar. Now make it feel like a well-made Mac app.

## Decisions already made (Jared, and the coordinator's recommendations)
1. **The app icon.**
   - From the chuck logo in `brand/`, make a proper macOS icon: a rounded square on Apple's icon grid, with depth and soft lighting. It must read well at 16 px and at 1024 px, and in light and dark Docks.
   - Ship an `.icns` with every size, a Windows `.ico` and Linux PNGs.
   - A dev build (`npm run dev`) gets a variant with a small "DEV" band, set at runtime with `app.dock.setIcon`.
   - Render from SVG with a script (as brief 47 did with `rsvg-convert`), and commit the outputs.
2. **The Dock.**
   - A badge with the number of check errors in the focused window's product, updated on live reload and cleared when there are none.
   - The Dock menu has "New Window", which runs Open Product Folder, plus the recent folders, through `app.addRecentDocument` and the macOS document list.
3. **The app menu.**
   - "About Lathe": a small native About panel with the app version, the engine version, the Electron version, and links to the repo and the record format.
   - "Settings…" on Cmd+, opens `/settings/appearance` in the focused window.
   - "Check for Updates…" stays hidden until signing and publishing exist (step 3).
4. **Desktop-only record actions** (through the preload, as validated IPC):
   - "Reveal spec file in Finder" (`shell.showItemInFolder`), "Open in editor" (VS Code by default, with a setting for another command) and "Copy ID".
   - They appear in the inspector's facts (desktop only, as small ghost buttons per brief 54 if it has landed) and in a native right-click menu on record rows, nodes and the page title.
   - The app side shows them only when `latheDesktop` has them, and stays unchanged in a browser.
5. **One instance.** Use `app.requestSingleInstanceLock()`: a second launch, or opening a folder through Finder or the Dock, focuses the running app and opens that folder's window (or focuses it if it's already open).
6. **Launch and failure.**
   - The window shows the shell background at once, then a calm launch view (the logo and "Opening Tool Library…") until `/api/spec` answers. No white flash, and no blank window.
   - If the engine fails to load a folder, show an error page in the window, with the message, Retry, Open Another Folder, and Reveal in Finder.
7. **A native feel (macOS).**
   - The nav panel uses the system's sidebar material (`vibrancy: 'sidebar'`, with transparent nav backgrounds set by a desktop-only class), but only if it looks right with the themes. If it fights them, skip it and say why.
   - Overlay scrollbars.
   - `spellcheck: false`.
   - Native-styled context menus.
   - The window remembers whether it was full screen.
8. **Records:** requirements under the LA-DSK use cases, or a new use case "Feel like a native Mac app", with domain rules, components and tests from the next free LA-DSK numbers. Unit-test:
   - the badge count;
   - the dock menu model;
   - the single-instance routing;
   - the IPC validation for the record actions;
   - the error-page model.
   
   Extend the smoke test to check the icon and the launch view. List anything only a person can check as a manual test.

## Scope
- **You own:** `desktop/**`, the desktop-only app hooks (the record actions in the inspector, the right-click menu wiring, and the launch and error views), the small additions to the preload API, tests, and the records above.
- Check which agents are running when you start, and stay out of their files beyond these hooks.
- Never use port 5199 for anything you start.

## Report
Use the format in 00-common-rules, with your branch and its last commit, and the icon at 16, 32, 128 and 512 px (paths to the PNGs).
