# Brief: make the docs and plugin describe today's Lathe

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main`, after brief 65 (roles, not names) has merged. Work in your own worktree, and finish with your branch ready to merge.

## Goal
Many agents have edited the docs piecemeal. Make them read as one, current description of Lathe:
- the root `README.md`;
- `lathe/README.md`;
- `lathe/FORMAT.md`, the concepts;
- `desktop/` (a short README, if it's missing);
- the plugin: `plugin/README.md`, the skills under `plugin/skills/`, and `plugin/.claude-plugin/*.json`.

## What to do
1. **The root README:**
   - what Lathe is, in two paragraphs;
   - how to run it: dev server, `lathe check`, `lathe format`, `lathe serve`, and the desktop app (dev, start, pack);
   - a tour of the app: spaces, the nav's folders, the views (Wiki, Graph, Model), tabs, the side bar, quick find and the palette, shortcuts, themes, and mobile;
   - where the specs live, and links to FORMAT and REFERENCE.
   
   Keep it short and current, and cut anything stale.
2. **`lathe/README.md`:** the package (CLI, config, API, the database tables), current, with every option it really has. Check them against the code.
3. **The plugin skills:** each skill describes the record kinds and checks as they are now:
   - layers, entities and domain events;
   - structure sizes, relation labels and roles (Owner, Reader, Agent);
   - the generated reference.
   
   Point to `lathe format` or `lathe/REFERENCE.md` for lists rather than copying them. Bump the plugin version.
4. **Check every code block and command** in the docs against the code by running it (in your worktree, never port 5199), and fix or remove what doesn't work.
5. **Write in plain American English.** Specs and docs name roles, not people. The package scope and author fields stay.

## Scope
- **You own:** those doc files and `plugin/**`.
- **Not yours:** code, apart from fixing a doc comment you find wrong; list it instead.

## Report
Use the format in 00-common-rules, with your branch and its last commit, and the commands you ran with their results.
