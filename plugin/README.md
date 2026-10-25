# Lathe plugin for Claude Code

Most Lathe specs are written by agents. This plugin teaches them Lathe's way of working and keeps the specs honest while they edit.

The skills teach the way of working, not the lists: for every kind, relation, folder and check, they send the agent to the generated reference (`lathe format`, or `REFERENCE.md` in the Lathe package), so they stay right as the meta-model grows. Like the specs, they name roles (Owner, Reader, Agent, or a product's own, such as Librarian), never people.

## What it does

**Skills** (Claude loads one when the task matches, or you call it as `/lathe:<name>`):

| Skill | For |
| --- | --- |
| `model-a-domain` | The domain record, aggregates, their entities (for the ERDs), the domain events they raise, and domain rules. |
| `write-use-cases` | Use cases and their requirements, the roles that act in them, the capabilities that group them, and the patterns they follow. |
| `design-the-domain` | Flows and their steps, views, endpoints, their interaction requirements, and components in their layers, with the links that trace them. |
| `plan-tests` | Test records (automated, manual or planned), and test names that carry the test's ID or the ID of what it proves. |
| `check-and-fix` | Running `lathe check`, fixing errors with the reference's help, and reporting warnings (gaps, links between stages, structure sizes) and coverage (designed, built, proved, planned). |
| `extend-the-meta-model` | A product's own kinds, relations (with their labels), folders and ID patterns, widening a default kind, marking obligation kinds and relation roles, and a product's own checks. |

**Hook.** After every `Write`, `Edit` or `MultiEdit`, [scripts/check-after-edit.mjs](scripts/check-after-edit.mjs):

1. Walks up from the edited file to the nearest `lathe.config.json`. With none, it does nothing.
2. Does nothing unless the file is a record in the configured specs folder (any `*.md` but `README.md`), `lathe.config.json` itself, or a `.csv` in the meta-model (the config's `metaExtensions` folder, and `lathe/meta/` in the Lathe repo).
3. Runs the check: `node bin/lathe.ts check` from `lathe/` in the Lathe repo (what `npm --prefix lathe run check` runs), or `node_modules/.bin/lathe check` in a product repo. It never uses `npx`, so it never downloads anything. If Lathe is not installed, it does nothing.
4. If the check finds errors, it shows them to the agent next to the tool result, so the agent fixes them before going on. Warnings and a clean check stay silent.

The hook never stops the edit (it has already happened) and gives up quietly if the check cannot start or takes over 50 seconds. A check of the Lathe repo, about 1,700 records, takes under a second.

## Install it in a product repo

The product repo needs Node and Lathe installed (`npm install --save-dev <lathe package>`, then `npx lathe init`; see the Lathe package README).

In Claude Code, add this folder as a marketplace and install the plugin from it:

```
/plugin marketplace add /path/to/Lathe/plugin
/plugin install lathe@lathe
```

Or from a shell: `claude plugin marketplace add /path/to/Lathe/plugin`, then `claude plugin install lathe@lathe`. Choose the project scope to share it with everyone working in that repo (it is written to the repo's `.claude/settings.json`), or the user scope for yourself only.

To try it for one session without installing: `claude --plugin-dir /path/to/Lathe/plugin`.

## Files

```
plugin/
  .claude-plugin/plugin.json        the plugin manifest (name: lathe)
  .claude-plugin/marketplace.json   a one-plugin marketplace, so the folder can be added with /plugin marketplace add
  hooks/hooks.json                  the PostToolUse hook
  scripts/check-after-edit.mjs      what the hook runs
  skills/<name>/SKILL.md            the six skills
```

Validate after changing it: `claude plugin validate plugin`.
