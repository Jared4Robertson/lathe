# Lathe plugin for Claude Code

Most Lathe specs are written by agents. This plugin teaches them Lathe's way of working and gives them the tools to change the spec, which is typed data in the repo's `data/` folder, through Lathe's command layer: every write is checked against the schema and refused, with its reasons, when it breaks the model. Nothing edits the data files by hand.

The skills teach the way of working, not the lists: every table, column and relation is in the tools' input schemas, generated from Lathe's schema, and every check is explained in the generated reference (`REFERENCE.md` in the Lathe package), so they stay right as the schema grows. Like the specs, they name roles (Owner, Reader, Agent, or a product's own, such as Librarian), never people.

## What it does

**MCP tools** (the `lathe` server, started by [scripts/mcp-server.mjs](scripts/mcp-server.mjs)):

| Tool | Does |
| --- | --- |
| `add` | Adds a record to its kind's table, or a part, declaration or checking row. |
| `set` | Changes columns of a row; null clears one. Keys and parent columns stay. |
| `move` | Moves a record under another parent; what sits inside it moves along. |
| `link`, `unlink` | Adds or removes a link between two records. |
| `remove` | Removes a record with its parts and the links it starts, or a part row; refused while anything else references it. |
| `show` | Reads a record with its parent (or, with no owner, its product or domain), parts, children and links. |
| `list` | Reads a table's rows, or those under a parent (for a kind with no owner, those of a product or domain). |
| `next_id` | Gives the next free ID for a kind under a parent: scoped to the parent, the domain or the product, as the kind's ID pattern says. |
| `check` | Runs `lathe check`: every error and warning, and the recorded exceptions. |

A write returns the rows it changed and the files it wrote, or the refusal with every reason; a refusal changes nothing. Writes never commit: the Agent commits per task, so git history shows who changed what. The launcher finds the repo with `lathe.config.json` at or above the project folder and runs that repo's own `lathe mcp` (`node_modules/.bin/lathe` in a product repo, `lathe/bin/lathe.ts` from source in the Lathe repo), so the tools match its installed Lathe and its own kinds. It never uses `npx`, so it never downloads anything. The skills are written for one major version of Lathe, recorded as `lathe.major` in [.claude-plugin/plugin.json](.claude-plugin/plugin.json): when the repo's installed Lathe has another major version, the launcher adds a warning, with the installed version and schema version, to the first tool result of the session. A product whose data is for another schema version than its Lathe gets only the `check` tool, which says what to do (`npx lathe upgrade`, or update Lathe). The same operations are the `lathe` CLI's `add`, `set`, `move`, `link`, `unlink`, `remove`, `show`, `list` and `next-id` commands, for the Owner.

**Skills** (Claude loads one when the task matches, or you call it as `/lathe:<name>`):

| Skill | For |
| --- | --- |
| `discover-outcomes` | The discovery stage: the product's business outcomes, each a measurable statement with its measure and target, the capabilities that serve them and what measures them. |
| `model-a-domain` | Domains as vertical slices of business capability, the order of the whole spec, and the domain model in event storming order: aggregates, entities and fields, commands and events (one aggregate per command, recorded exceptions, the outbox), invariants, value objects and constraints, specifications, policies, read models and queries, domain services and terms. |
| `write-use-cases` | Capabilities, use cases with their actors and UC requirements, the product's roles, and the patterns use cases share with their settings and rules. |
| `design-interactions` | The product's interfaces, each use case's flows (one per interface) and their steps (invoking a command or query, in a view, fulfilling UC requirements), views and view requirements, endpoints under their command or query with API requirements, and integrations. |
| `write-the-technical-spec` | The one technical record that implements each design record, with its file; tables and their keys; event types and their delivery; the domain and application layers; standards. |
| `plan-tests` | The test kinds, one per thing tested, each under what it proves, with its run by (level, state, a file or manual reason, size and markers), the test data sets tests start from, and test names that carry the test's ID. |
| `check-and-fix` | Running the check, reading a refused write, fixing errors, and reporting warnings, gaps and coverage (designed, built, proved). |
| `extend-the-meta-model` | A product's own kinds in any of the six stages, their fields and relations (with their labels), obligation kinds and relation roles, and a product's own checks. |

**Hook.** Before every `Write`, `Edit`, `MultiEdit` or `NotebookEdit`, [scripts/guard-data-files.mjs](scripts/guard-data-files.mjs) refuses an edit of a `.jsonl` file in a Lathe repo's data folder (the one `lathe.config.json` names, default `data/`, and `lathe/data/` in the Lathe repo), and tells the agent to use the tools instead. Every other edit goes through untouched.

## Install it in a product repo

The product repo needs Node and Lathe installed (`npm install --save-dev <lathe package>`, then `npx lathe init`; see the Lathe package README).

In Claude Code, add this folder as a marketplace and install the plugin from it:

```
/plugin marketplace add /path/to/Lathe/plugin
/plugin install lathe@lathe
```

Or from a shell: `claude plugin marketplace add /path/to/Lathe/plugin`, then `claude plugin install lathe@lathe`. Choose the project scope to share it with everyone working in that repo (it is written to the repo's `.claude/settings.json`), or the user scope for yourself only. In a folder with no `lathe.config.json` the MCP server does not start, and says why.

To try it for one session without installing: `claude --plugin-dir /path/to/Lathe/plugin`.

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
