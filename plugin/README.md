# Lathe plugin for Claude Code

Most Lathe specs are written by agents. This plugin teaches them Lathe's way of working and gives them the tools to change the spec, which is typed data in the repo's `data/` folder. Every kind of record belongs to one aggregate of Lathe's own model, and each aggregate has its own commands: each checks that aggregate's rules and refuses, with every reason, a change that breaks them. Nothing edits the data files by hand.

The skills teach the way of working and name the tools for each stage's work; every tool's fields, with each column's type and meaning, are in its input schema, generated from Lathe's schema, and every check is explained in the generated reference (`REFERENCE.md` in the Lathe package), so they stay right as the schema grows. Like the specs, they name roles (Owner, Reader, Agent, or a product's own, such as Librarian), never people.

## What it does

**MCP tools** (the `lathe` server, started by [scripts/mcp-server.mjs](scripts/mcp-server.mjs)), one per command and query of each aggregate, named `<aggregate>_<command>`:

| Tools | Do |
| --- | --- |
| `<aggregate>_add_<kind>`, `<aggregate>_change_<kind>`, `<aggregate>_remove_<kind>` | Add, change or remove a record of a kind the aggregate holds, such as `use_case_add_flow_step`, `aggregate_change_entity` or `domain_remove_term`. A record's parts and the links it starts are fields of its own add and change (a list replaces the list, `null` clears a single link); a change never takes a parent column; a remove takes what sits under the record with it, and is refused while anything else references it, naming what does. |
| `use_case_move_use_case`, `endpoint_move_endpoint`, `table_move_table`, `product_move_question` | Move a record that really moves to another parent; what sits inside it moves along, keeping its IDs. |
| `pattern_following_follow_pattern`, `pattern_following_change_setting_values`, `pattern_following_stop_following_pattern` | A domain or use case follows a pattern, with its setting values, or stops. |
| `<aggregate>_get_<aggregate>`, `<aggregate>_list_<aggregate>s`, `<aggregate>_next_id` | Read an aggregate whole, by the ID of any record in it; list those under a parent; give the next free ID for a kind it holds under a parent (one past the highest in use). |
| `check` | Runs `lathe check`: every error and warning, and each product's coverage with its gaps. |
| `app_focus` | Says what the Reader is looking at in the Lathe app window: the page, the focused record, the stage and the selection. Listed only when Claude Code runs in the desktop app's chat panel. |
| `app_open` | Opens a record in that window, on a stage of choice. Listed only in the desktop app's chat; refused once its window has closed. |

The aggregates are the Product (with its interfaces, open questions and declared kinds), Business outcome, Domain (capabilities, terms, domain services, repositories, services), Aggregate (entities, invariants, data models), Domain event (event types), Command (handlers, policies, event handlers), Value object (constraints, value types), Specification (predicates), Read model (queries, projections, query handlers), Table, Use case (UC requirements, flows, steps), View, Endpoint (API requirements, handlers), Integration (adapters), UI component, Pattern, Standard, Test data set, Entry point, Tooling, Extension record (a record of a product's own kind), Check, Product setting and Pattern following; each test sits in the aggregate of what it proves. Claude Code defers a large tool set behind its tool search, and each skill names the tools its work uses.

A command returns what it changed and the files it wrote, or the refusal with every reason; a refusal changes nothing. Writes never commit: the Agent commits per task, so git history shows who changed what. The launcher finds the repo with `lathe.config.json` at or above the project folder and runs that repo's own `lathe mcp` (`node_modules/.bin/lathe` in a product repo, `lathe/bin/lathe.ts` from source in the Lathe repo), so the tools match its installed Lathe and its own kinds; under the desktop app's chat, it runs the Lathe the window runs, which the app names in `LATHE_CLI`. It never uses `npx`, so it never downloads anything. The skills are written for one major version of Lathe, recorded as `lathe.major` in [.claude-plugin/plugin.json](.claude-plugin/plugin.json): when the repo's installed Lathe has another major version, the launcher adds a warning, with the installed version and schema version, to the first tool result of the session. A product whose data is for another schema version than its Lathe gets only the `check` tool, which says what to do (`npx lathe upgrade`, or update Lathe). The same commands are the `lathe` CLI's `lathe <aggregate> <command>`, such as `lathe use-case add-flow-step`, for the Owner; each takes its fields as flags (`--<field> <value>`) or the tool's own JSON with `--json -` (stdin) or `--json <file>`, so a script's long text arrives intact, and `lathe <aggregate> --help` lists an aggregate's commands. `lathe app focus` and `lathe app open <id> [--stage graph|erd|trace]` are `app_focus` and `app_open` from a shell in the desktop app's chat, through the same bridge, and are refused with no window connected.

**Skills** (Claude loads one when the task matches, or you call it as `/lathe:<name>`):

| Skill | For |
| --- | --- |
| `discover-outcomes` | The discovery stage: the product's business outcomes, each a measurable statement with its measure and target, the capabilities that serve them and what measures them. |
| `model-a-domain` | Domains as vertical slices of business capability, the order of the whole spec, and the domain model in event storming order: aggregates, entities and fields, commands and events (one aggregate per command, the outbox), invariants, value objects and constraints, specifications, policies, read models and queries, domain services and terms. |
| `write-use-cases` | Capabilities, use cases with their actors and UC requirements, how each is named, the product's roles, and the patterns use cases share with their settings and rules. |
| `design-interfaces` | The product's interfaces (the roles that use each, the use cases it offers, its pattern), each use case's one flow and its steps (invoking a command or query, fulfilling UC requirements, a variant only where one interface alone does it), views that present commands and queries and their view requirements, endpoints under their command or query with API requirements, and integrations. |
| `write-the-technical-spec` | The one technical record that implements each design record, with its file; tables and their keys; event types and their delivery; the domain and application layers; standards. |
| `plan-tests` | The test kinds, one per thing tested, each under what it proves, with its run by (level, state, a file or manual reason, size and markers), the test data sets tests start from, and test names that carry the test's ID. |
| `check-and-fix` | Running the check, reading a refused command, fixing errors, and reporting warnings, gaps and coverage (designed, built, proved). |
| `extend-the-meta-model` | A product's own kinds in any of the six stages, their fields and relations (with their labels), obligation kinds and relation roles, and a product's own checks. |

**Hook.** Before every `Write`, `Edit`, `MultiEdit` or `NotebookEdit`, [scripts/guard-data-files.mjs](scripts/guard-data-files.mjs) refuses an edit of a `.jsonl` file in a Lathe repo's data folder (the one `lathe.config.json` names, default `data/`, and `lathe/data/` in the Lathe repo), and tells the agent to use each aggregate's own tools instead. Every other edit goes through untouched.

## Install it in a product repo

The product repo needs Node and Lathe installed (`npm install --save-dev <lathe package>`, then `npx lathe init`; see the Lathe package README).

In Claude Code, add this folder as a marketplace and install the plugin from it:

```
/plugin marketplace add /path/to/Lathe/plugin
/plugin install lathe@lathe
```

Or from a shell: `claude plugin marketplace add /path/to/Lathe/plugin`, then `claude plugin install lathe@lathe`. Choose the project scope to share it with everyone working in that repo (it is written to the repo's `.claude/settings.json`), or the user scope for yourself only. In a folder with no `lathe.config.json` the MCP server does not start, and says why.

To try it for one session without installing: `claude --plugin-dir /path/to/Lathe/plugin`.

The Lathe package ships this plugin in `dist/plugin`, and the desktop app's chat loads it into every session it starts with `--plugin-dir` (the plugin of the Lathe the window runs), so the tools are there whether or not the plugin is installed; a session plugin takes the place of an installed plugin of the same name, so there are never two sets of `lathe` tools. The tools that only read (`check`, every aggregate's queries and `app_focus`) are marked `readOnlyHint`, which the chat's Accept reads mode runs without asking. In the chat's **View only** mode, the app sets `LATHE_VIEW_ONLY=1` for the session: the server lists only the reads (and `app_open`) and refuses any command, saying the chat is View only. Under the desktop chat, the server's instructions tell Claude to use `app_focus` and `app_open` for anything about the window, never the code.

## Files

```
plugin/
  .claude-plugin/plugin.json        the plugin manifest (name: lathe)
  .claude-plugin/marketplace.json   a one-plugin marketplace, so the folder can be added with /plugin marketplace add
  .mcp.json                         the lathe MCP server
  hooks/hooks.json                  the PreToolUse hook
  scripts/mcp-server.mjs            starts the repo's own lathe mcp
  scripts/guard-data-files.mjs      what the hook runs
  scripts/lathe-root.mjs            what both scripts share: the repo root, its data folders, its lathe command
  skills/<name>/SKILL.md            the eight skills
```

The MCP server itself is `lathe mcp` in the Lathe package (`lathe/src/cli/mcp.ts`); its tests, and the tests of these scripts and of the skills' examples against the schema, are in `lathe/test/cli/`. Validate after changing the plugin: `claude plugin validate plugin`.
