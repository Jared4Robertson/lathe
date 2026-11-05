# Lathe

What a product must do, and why, is decided once and written as records, and Agents build from those records, not from a chat that scrolls away. Lathe refuses a wrong write and checks the rest, so Agents build it right the first time without the Owner policing them. Because of both, the Owner understands the product better than its builders: why every part exists, what a change would touch before it is made, and views of it no one had before.

## What it is

A lathe is a tool that makes tools, including better lathes. Lathe keeps a product's spec (business outcomes, domain model, use cases, interface design, technical design and tests) as typed data: a table per kind of record, kept as one `data/<table>.jsonl` file per table in the product's own repo, with git as its history. A database loads them with every key and rule of its schema, so data that breaks the model cannot be saved; checks report the work still to do; coverage traces each business outcome through the journeys and capabilities that serve it, and each obligation to the code that builds it and the tests that prove it; and a web app lets you read, navigate and edit the result.

Lathe describes itself in its own format: its specification is the data in [data/](data/), and `lathe check` runs on it as on any product. Most records are written by agents; the [Claude Code plugin](plugin/) gives them MCP tools, one per command of each aggregate of the model, the same commands the CLI and the app run. Specs name roles (Owner, Reader, Agent), never people.

## What's here

| Folder | What it is |
| --- | --- |
| [lathe/](lathe/) | The tool: the schema, the store, the engine and Lathe's checks, the `lathe` command and the server. Packaged as `@jaredrob/lathe`; see its [README](lathe/README.md). |
| [app/](app/) | The web app's source. Built into the package for `lathe serve`. |
| [desktop/](desktop/) | Lathe as a desktop app: an Electron shell around the web app and server. See its [README](desktop/README.md). |
| [plugin/](plugin/) | The Claude Code plugin: skills for writing records, an MCP tool per command and query of each aggregate, and a hook that refuses hand edits to data files. |
| [data/](data/) | Lathe's own specification (product `LA`), with this repo's own checks in `data/check.jsonl`. |
| [examples/tool-library/](examples/tool-library/) | The example product (`TL`): its code, whose tests carry their spec IDs, and its specification in its own `data/`. |
| [notes/](notes/) | Notes for contributors: the store's interfaces, the audits behind the accessibility and stability suites, and the phone layout's design. |
| [brand/](brand/) | The logo and favicon, and the script that builds their preview page. |

## Install and run

You need Node 26 or later (see [.nvmrc](.nvmrc)) and npm. Clone the repo and install each package you need:

```sh
npm ci --prefix lathe && npm ci --prefix app && npm ci --prefix desktop
```

| What | Command |
| --- | --- |
| The web app, for working on Lathe | `npm --prefix app run dev` serves this repo at http://localhost:5199 and reloads as the data or app code change, with the Tool Library beside Lathe, as this repo's `lathe.config.json` lists it under `products`. `LATHE_ROOT=/path/to/product` points it at another product repo (or workspace); `-- --port <n>` picks another port. `npm --prefix app run dev:network` serves it on the local network too (Vite prints the addresses), read only for other devices. |
| Check the spec | `npm --prefix lathe run check` checks Lathe's spec and the Tool Library's, each on its own, prints errors, warnings and coverage, and exits 1 on any error. Both checks are strict: a warning beyond the count each accepts fails it too. |
| Change the spec | `npm --prefix lathe run lathe -- <aggregate> <command> --root .. --<field> <value> ...`, such as `use-case add-flow-step`: each aggregate's own commands, which check its rules; or edit a record in the app. `lathe help` lists the aggregates, and `lathe <aggregate> --help` their commands. |
| The reference | `npm --prefix lathe run reference` regenerates [lathe/REFERENCE.md](lathe/REFERENCE.md): stage by stage, every kind with its table, its checks and its coverage gaps, then every relation. |
| Serve a built app | `npm --prefix lathe run build`, then `npm --prefix lathe run lathe -- serve --root ..` serves the built app at http://127.0.0.1:5330. |
| The desktop app | `npm --prefix desktop run dev` (hot-reloading), `npm --prefix desktop run start` (from the built package) or `npm --prefix desktop run pack` (a `Lathe.app` in `desktop/release/`). |
| Tests | `npm --prefix lathe test`, `npm --prefix app test` and `npm --prefix desktop test` (at most 2 workers each), with `run typecheck` in each package. `npm --prefix app run test:stability` runs the stability suite: Playwright in Chromium, checking that nothing on the page jumps, in about two minutes. |

In a product repo of your own, the same commands are `npx lathe init`, `npx lathe check`, `npx lathe <aggregate> <command> ...` and `npx lathe serve`, once the package is installed there; the [package README](lathe/README.md) has every option. The npm scripts above run in `lathe/`, so `--root ..` names this repo. The package is not published to npm yet: build it with `npm --prefix lathe run build` and `npm pack` in `lathe/`, and install the tarball.

## The Claude Code plugin

Most records are written by agents. The [plugin](plugin/) gives Claude Code one MCP tool per command and query of each aggregate (each checks its aggregate's rules and refuses a change that breaks them, with every reason), a skill per stage of the spec, and a hook that refuses hand edits to the data files. To install it, add the folder as a marketplace in Claude Code:

```
/plugin marketplace add /path/to/Lathe/plugin
/plugin install lathe@lathe
```

The [plugin README](plugin/README.md) lists every tool and skill.

## The desktop app

Lathe also runs as a desktop app: an Electron shell around the web app and its server, one window per product folder, with tabs, native menus, and a chat panel that runs your own Claude Code with Lathe's tools. `npm --prefix desktop run dev` starts it; `npm --prefix desktop run pack` builds an unsigned `Lathe.app` for macOS. See the [desktop README](desktop/README.md).

## The example product

[examples/tool-library/](examples/tool-library/) is a complete small product specified in Lathe: the HTTP API of a neighborhood tool library (product `TL`), with its domain model, use cases, endpoints, technical records and tests, and code whose tests carry their spec IDs, so every obligation traces to the code and tests that meet it. The dev server and `lathe check` load it beside Lathe's own spec. See its [README](examples/tool-library/README.md).

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first: every commit is signed off (DCO), each change is one branch and lands as one squash commit with a typed title, `scripts/ci.sh` runs the checks, and spec records change only through Lathe's commands. Report security problems privately, as [SECURITY.md](SECURITY.md) says. Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md).

On main, [release-please](.github/workflows/release-please.yml) keeps a release PR open with the next version and `CHANGELOG.md`; merging it tags the release and publishes it on GitHub.

## Upgrading

Lathe's schema has a version (in [lathe/schema/version.json](lathe/schema/version.json)), and each product's `lathe.config.json` names the version its data is for. The package follows semantic versioning: a breaking schema change raises the schema version and the major version, and ships a converter in `lathe/upgrades/`. A Lathe stops on data for another schema, saying what to do. To move a product to a new major version, update `@jaredrob/lathe` in its repo, commit, run `npx lathe upgrade`, finish the to-dos it prints, run `npx lathe check`, and commit the result as one commit. The Claude Code plugin warns once, in its tools' output, when its skills were written for another major version than the product's Lathe (`lathe.version` in [plugin/.claude-plugin/plugin.json](plugin/.claude-plugin/plugin.json), which each release sets to the release's version), and the desktop app opens a product with the product's own installed Lathe when it has one, and its bundled copy otherwise (About says which). The [package README](lathe/README.md#upgrading) has the details, and how to write a converter.

## A tour of the app

- **Spaces.** Each product is a space. A workspace shows its own product and each one its `lathe.config.json` lists under `products`. With two or more, the rail at the far left of the nav has one icon per product, and Alt+1 to Alt+9 switch between them; with one there is no rail. The nav, quick find and Checks follow the current space.
- **The nav's stages.** Under each domain, the nav follows the schema's stages: domain model, use cases, interface design, technical specification and test plan. Discovery, the first stage, holds the product's business outcomes and the journeys that reach them (use cases and handoffs in order, from a trigger to a result), which the product page lists first and Shared holds in the nav.
- **The stage and its panels.** A record, group, domain or product page shows one full-window stage, with the nav, the tab panel and the wiki card floating over it as frosted panels. Nothing replaces the stage: every tool (Checks, Appearance, the record format) opens over it. The stage is the **Graph** (the records around it as boxes and arrows, by level), the **ERD** (the entity-relationship diagram of a domain's aggregates and their entities, or of one aggregate; any other record shows its domain's, its nearest entity or aggregate highlighted) or the **Trace** (an obligation's chain drawn left to right, from why it is there through design and build to tests and files; above obligations, a tree of why on the left and a lane per obligation on the right, with every gap in view; a design, build or test record, the lanes that hold it; on a phone, the same as a table). Every stage works on every page. Switch them from the page bar or with Ctrl+G, Ctrl+E and Ctrl+T (Alt off a Mac), or Ctrl+1 to 3. The stage frames the focus in the space the panels leave. The **wiki card** is the focus's page (its body, fields, children and problems, with editing; More shows the whole page, with the record's kind, data file and links both ways, and its History from git); Enter collapses and shows it (from anywhere but a button, a link or a field), Escape collapses it, and its edge resizes it. The arrow keys, or W, A, S and D, walk the stage. A header strip under the tabs names the focus with its breadcrumb. The address names the stage (`?stage=erd`), so a link opens as it was seen.
- **Tabs.** In a browser, each browser tab is one place to explore: Cmd/Ctrl+click or middle-click a box or a link to open it in a new browser tab, and Back and Forward step through that tab's moves. The desktop app has tabs of its own, as a browser's: every move stays in the active tab, Cmd+T opens a new tab at the product, Cmd/Ctrl+click or middle-click opens a box or link in a new tab, Cmd+W closes one, Ctrl+Tab cycles, and each tab keeps its own stage, depth, filters, wiki card and history (Cmd+[ and Cmd+]). Each space keeps its own tabs.
- **Quick find and the palette.** Mod+P (or Mod+K) opens one centered box that jumps to any record, domain or product of the current space by ID or title; the stage previews the highlighted record, Enter goes there and Escape puts everything back. Typing `>` (or Mod+Shift+P) turns it into the command palette, which runs any command by name.
- **Shortcuts.** Press `?` for the shortcuts sheet. Others: Mod+B hides the nav, `g c` opens Checks, `g f` the reference, `g h` home, F8 the next problem on the page, F12 the focused link's record. Mod is Cmd on a Mac and Ctrl elsewhere.
- **Themes.** Five built-in themes (Lathe, Graphite, Midnight, Workshop, High contrast), each light, dark or following the system, and themes of your own, made and edited in Appearance, a popover at the foot of the nav (`g t` picks one).
- **Checks and the reference.** Checks (Tools › Checks, `g c`) is a panel over the stage listing the space's problems; selecting one focuses its record. The reference (`g f`) opens in the wiki card: a page per kind and per check, generated from the schema and the check rows.
- **Mobile.** Below 900 px wide the app shows one view at a time, with a compact top bar, the nav as a drawer, and the wiki card and the tools as bottom sheets. On a touch screen, targets are at least 44 px and one tap on a graph box opens it, as a click does.

## The data model

Records are rows in the data folder `lathe.config.json` names (here [data/](data/)): a table per kind with typed columns, one parent per record as a foreign key, a table per relation, and checks as rows of the `check` table. The kinds are drawn from domain-driven design, CQRS and event storming. The [package README](lathe/README.md#the-data-model) explains the model and how to change the data, and [lathe/REFERENCE.md](lathe/REFERENCE.md), generated from the schema, the check rows and the coverage rules, lists every table, column, relation, check and coverage gap by stage.

## License

Lathe is licensed under the [Apache License 2.0](LICENSE). See [NOTICE](NOTICE).
