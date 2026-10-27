# Brief: the CLI, MCP tools and plugin skills write data (database first, step 5)

Read [00-common-rules.md](00-common-rules.md), the plan [notes/plans/database-first.md](../plans/database-first.md) and [notes/db-first-interfaces.md](../db-first-interfaces.md) first. **Base branch: `db-first`.** Work in your own worktree from it, and finish with your branch ready to merge into `db-first`.

## Goal
Everyone changes the spec through the command layer, and nothing edits files by hand. The Agent uses MCP tools from the Claude Code plugin; the Owner uses the CLI and the app.

## Decisions
1. **CLI:**
   - `lathe add <kind> --field value…`, `lathe set <id> --field value…`, `lathe move <id> --parent <id>`, `lathe link <from> <relation> <to>`, `lathe unlink …`, `lathe remove <id>`, `lathe show <id>` and `lathe list <kind> [--parent <id>]`.
   - Each one validates through the command layer and prints the error clearly on refusal.
   - `lathe next-id <kind> --parent <id>` gives the next free ID.
   - Field flags and help come from the schema description, never hand-written per kind.
2. **MCP server:**
   - Shipped with the plugin. It exposes the same operations as tools (add, set, move, link, unlink, remove, show, list, next_id, check), with input schemas generated from the schema description.
   - Tool results return the changed rows, or the refusal with its reason.
3. **Plugin skills:** every skill that tells the Agent to write or edit Markdown spec files is rewritten to use the tools, including the modeling skill's guidance, examples and file paths. No skill mentions `specs/` folders, YAML headers or Markdown bodies.
4. **Commit attribution:** writes don't commit. The Agent commits per task as today, so git history shows Agent or Owner by author.

## Owns
The CLI entry and commands (`lathe/src/cli*` or wherever the CLI lives; coordinate by keeping your changes to new files plus the command registration), the plugin folder (its MCP server, skills and manifest), and their tests. Don't touch `lathe/src/store/` (call it), `lathe/checks` or `app/`.

## Checks
- Unit tests for each CLI command and MCP tool, covering a good write, a refusal and the output format.
- An end-to-end test: add a domain, use case and requirement, link a component and test, then check that the files changed as expected and the data loads.
- The full checks for lathe and the plugin, gated on real exit codes. Never use port 5199.

## Report
The branch and its last commit, the commands and tools, the skills changed, and the checks run with their results. Leave nothing open.
