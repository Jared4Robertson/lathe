# Lathe

A lathe is a tool that makes tools, including better lathes. Lathe organizes a product's lifecycle (discovery, domain model, use cases, interaction design, technical specification, test plan) as typed data: a table per kind of record, kept as one `data/<table>.jsonl` file per table in the product's own repo. A database loads them with every key and rule of its schema, so data that breaks the model cannot be saved; checks report the work still to do, coverage traces each business outcome through the capabilities that serve it, and each obligation to the code that builds it and the tests that prove it, and a web app lets you read, navigate and edit the result.

Lathe describes itself in its own format: its specification is the data in [data/](data/), and `lathe check` runs on it as on any product. Most records are written by agents; the [Claude Code plugin](plugin/) gives them MCP tools that write through the same command layer as the CLI and the app. Specs name roles (Owner, Reader, Agent), never people.

## What's here

| Folder | What it is |
| --- | --- |
| [lathe/](lathe/) | The tool: the schema, the store, the engine and Lathe's checks, the `lathe` command and the server. Packaged as `@jaredrob/lathe`; see its [README](lathe/README.md). |
| [app/](app/) | The web app's source. Built into the package for `lathe serve`. |
| [desktop/](desktop/) | Lathe as a desktop app: an Electron shell around the web app and server. See its [README](desktop/README.md). |
| [plugin/](plugin/) | The Claude Code plugin: skills for writing records, MCP tools that write through the command layer, and a hook that refuses hand edits to data files. |
| [data/](data/) | Lathe's own specification (product `LA`), with this repo's own checks in `data/check.jsonl`. |
| [examples/tool-library/](examples/tool-library/) | The example product (`TL`): its code, whose tests carry their spec IDs, and its specification in its own `data/`. |
| [notes/](notes/) | Notes for contributors: the store's interfaces, the audits behind the accessibility and stability suites, and the phone layout's design. |

## Run it

Install each package you need (Node 26):

```sh
npm --prefix lathe install && npm --prefix app install && npm --prefix desktop install
```

| What | Command |
| --- | --- |
| The web app, for working on Lathe | `npm --prefix app run dev` serves this repo at http://localhost:5199 and reloads as the data or app code change. with the Tool Library beside Lathe, as this repo's `lathe.config.json` lists it under `products`. `LATHE_ROOT=/path/to/product` points it at another product repo (or workspace); `-- --port <n>` picks another port. |
| Check the spec | `npm --prefix lathe run check` checks Lathe's spec and the Tool Library's, each on its own, prints errors, warnings and coverage, and exits 1 on any error. |
| Change the spec | `npm --prefix lathe run lathe -- add <table> --root .. --<column> <value> ...`, and `set`, `move`, `link`, `unlink` and `remove`, through the command layer; or edit a record in the app. `lathe help` lists them. |
| The reference | `npm --prefix lathe run reference` regenerates [lathe/REFERENCE.md](lathe/REFERENCE.md): stage by stage, every kind with its table, its checks and its coverage gaps, then every relation. |
| Serve a built app | `npm --prefix lathe run build`, then `npm --prefix lathe run lathe -- serve --root ..` serves the built app at http://127.0.0.1:5330. |
| The desktop app | `npm --prefix desktop run dev` (hot-reloading), `npm --prefix desktop run start` (from the built package) or `npm --prefix desktop run pack` (a `Lathe.app` in `desktop/release/`). |
| Tests | `npm --prefix lathe test`, `npm --prefix app test` and `npm --prefix desktop test` (at most 2 workers each), with `run typecheck` in each package. `npm --prefix app run test:stability` runs the stability suite: Playwright in Chromium, checking that nothing on the page jumps, in about two minutes. |

Once per clone, set up the merge driver for the data files (`data/*.jsonl`, named in [.gitattributes](.gitattributes)), so git merges them row by row (see the [package README](lathe/README.md#the-merge-driver)):

```sh
git config merge.lathe-data.name "Lathe data files"
git config merge.lathe-data.driver "node lathe/bin/lathe.ts merge-data %O %A %B %P"
```

The npm scripts run in `lathe/`, so `--root ..` names this repo. In a product repo, the same commands are `npx lathe check`, `npx lathe add ...` and `npx lathe serve`; the [package README](lathe/README.md) has every option.

## Upgrading

Lathe's schema has a version (in [lathe/schema/version.json](lathe/schema/version.json)), and each product's `lathe.config.json` names the version its data is for. The package follows semantic versioning: a breaking schema change raises the schema version and the major version, and ships a converter in `lathe/upgrades/`. A Lathe stops on data for another schema, saying what to do. To move a product to a new major version, update `@jaredrob/lathe` in its repo, commit, run `npx lathe upgrade`, finish the to-dos it prints, run `npx lathe check`, and commit the result as one commit. The Claude Code plugin warns once, in its tools' output, when its skills were written for another major version than the product's Lathe (`lathe.major` in [plugin/.claude-plugin/plugin.json](plugin/.claude-plugin/plugin.json)), and the desktop app opens a product with the product's own installed Lathe when it has one, and its bundled copy otherwise (About says which). The [package README](lathe/README.md#upgrading) has the details, and how to write a converter.

## A tour of the app

- **Spaces.** Each product is a space. A workspace shows its own product and each one its `lathe.config.json` lists under `products`. With two or more, the rail at the far left of the nav has one icon per product, and Alt+1 to Alt+9 switch between them; with one there is no rail. The nav, quick find and Checks follow the current space.
- **The nav's stages.** Under each domain, the nav follows the schema's stages: domain model, use cases, interaction design, technical specification and test plan. Discovery, the first stage, holds the product's business outcomes, which the product page lists first and Shared holds in the nav.
- **Views.** A record, group, domain or product page opens in one or more views side by side: **Wiki** (the record as a page: its body, fields, children, links in and out, and problems; a domain page adds its stages, coverage and open questions), **Graph** (the records around it as boxes and arrows, by level), and **Model** (on a domain, aggregate or entity page: the entity-relationship diagram of a domain's aggregates and their entities, or of one aggregate). Toggle them from the page bar or with Ctrl+W, Ctrl+G and Ctrl+M (Alt off a Mac); Ctrl+3 makes the focused view full screen. The address names the open views (`?view=wiki,graph`), so a link opens as it was seen.
- **Tabs.** Each space keeps its own tabs, as VS Code's editors: a new page opens in the preview tab (italic) until you keep it (double-click, or Ctrl+K Enter). Ctrl+Tab cycles; Alt+Shift+W closes.
- **The side bar.** On the right, it shows the focused record's kind, fields, parent, children, links both ways, problems and coverage gaps, and what the graph connects to it. Mod+Alt+B shows or hides it, and its edge drags to resize.
- **Quick find and the palette.** Mod+P (or Mod+K) jumps to any record, domain or product by ID or title, the current space first. Mod+Shift+P opens the command palette, which runs any command by name.
- **Shortcuts.** Press `?` for the shortcuts sheet. Others: Mod+B hides the nav, `g c` opens Checks, `g f` the reference, `g h` home, F8 the next problem on the page, F12 the focused link's record. Mod is Cmd on a Mac and Ctrl elsewhere.
- **Themes.** Five built-in themes (Lathe, Graphite, Midnight, Workshop, High contrast), each light, dark or following the system, and themes of your own, made and edited in Settings › Appearance (`g t` picks one).
- **Checks and the reference.** Checks lists every problem, filtered by space. The reference pages (`g f`) show a page per kind and per check, generated from the schema and the check rows.
- **Mobile.** Below 900 px wide the app shows one view at a time, with a compact top bar, the nav as a drawer and the side bar as a bottom sheet. On a touch screen, targets are at least 44 px and a tap on a graph box selects it before a second tap opens it.

## The data model

Records are rows in the data folder `lathe.config.json` names (here [data/](data/)): a table per kind with typed columns, one parent per record as a foreign key, a table per relation, and checks as rows of the `check` table. The kinds are drawn from domain-driven design, CQRS and event storming. The [package README](lathe/README.md#the-data-model) explains the model and how to change the data, and [lathe/REFERENCE.md](lathe/REFERENCE.md), generated from the schema, the check rows and the coverage rules, lists every table, column, relation, check and coverage gap by stage.
