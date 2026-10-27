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
| `show` | Reads a record with its parts, children and links. |
| `list` | Reads a table's rows, or those under a parent. |
| `next_id` | Gives the next free ID for a kind under a parent. |
| `check` | Runs `lathe check`: every error and warning. |

A write returns the rows it changed and the files it wrote, or the refusal with every reason; a refusal changes nothing. Writes never commit: the Agent commits per task, so git history shows who changed what. The launcher finds the repo with `lathe.config.json` at or above the project folder and runs that repo's own `lathe mcp` (`node_modules/.bin/lathe` in a product repo, `lathe/bin/lathe.ts` from source in the Lathe repo), so the tools match its installed Lathe and its own kinds. It never uses `npx`, so it never downloads anything. The same operations are the `lathe` CLI's `add`, `set`, `move`, `link`, `unlink`, `remove`, `show`, `list` and `next-id` commands, for the Owner.

**Skills** (Claude loads one when the task matches, or you call it as `/lathe:<name>`):

| Skill | For |
| --- | --- |
| `model-a-domain` | Domains as vertical slices of business capability, then the domain record, aggregates, their entities and fields (for the ERDs), the domain events they raise, and domain rules. |
| `write-use-cases` | Use cases with their actors and steps, their requirements, the roles that act in them, the capabilities that group them, and the patterns they follow with their settings. |
| `design-the-domain` | Flows and their steps, views, APIs and endpoints, integrations, their interaction requirements, and components in their layers, with the links that trace them. |
| `plan-tests` | Test records (automated, manual or planned), and test names that carry the test's ID or the ID of what it proves. |
| `check-and-fix` | Running the check, handling a refused write, fixing errors, and reporting warnings (gaps, links between stages, structure sizes) and coverage (designed, built, proved, planned). |
| `extend-the-meta-model` | A product's own kinds, their fields and relations (with their labels), obligation kinds and relation roles, and a product's own checks. |

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
  skills/<name>/SKILL.md            the six skills
```

The MCP server itself is `lathe mcp` in the Lathe package (`lathe/src/cli/mcp.ts`); its tests, and the tests of these scripts and of the skills' examples against the schema, are in `lathe/test/cli/`. Validate after changing the plugin: `claude plugin validate plugin`.
