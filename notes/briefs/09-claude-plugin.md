# Brief: the Lathe plugin for Claude Code

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `pass-3`.

## Goal
Most spec writing will be done by agents. Give them a Claude Code plugin that teaches them Lathe's way of working and keeps the specs honest as they edit: skills for writing each kind of record, and a hook that runs `lathe check` after a spec file changes and tells the agent about any error it introduced.

## Decisions already made (by Jared)
- **LA-Q04:** the plugin comes first, before the GitHub Action.
- The plugin works in any product repo that has Lathe installed (`npx lathe check --root <repo>`) and in this repo (`npm --prefix lathe run check`). It finds the repo by walking up from the edited file to `lathe.config.json`.

## Scope
- Read first: `lathe/FORMAT.md`, `lathe/README.md`, `lathe/meta/*.csv`, a few records under `specs/tool-library/` as examples, and for reference S2's agent setup (read-only): `~/Development/S2_sandbox/.agents/` (skills and plugin marketplace layout) and `~/Development/S2_sandbox/.claude/settings.json`. Never open any `.env*` file. Check the current Claude Code plugin format (plugin manifest, skills, hooks, marketplace) from the official documentation (https://docs.claude.com/en/docs/claude-code/plugins and the hooks reference) rather than guessing.
- You own: `plugin/**` (new).
- Out of scope: changing the engine, app or specs, and installing the plugin into anyone's settings.

## What to build
1. `plugin/` as a Claude Code plugin (and a local marketplace file, so it can be added with `/plugin marketplace add`): name `lathe`.
2. Skills, each short and concrete, with an example record: `model-a-domain` (aggregates and domain rules), `write-use-cases` (use cases and requirements), `design-the-domain` (flows, views, endpoints, components with their links), `plan-tests` (test records, and test names carrying the ID), and `check-and-fix` (run the check, read errors versus warnings, fix errors, report coverage).
3. A PostToolUse hook on Write, Edit and MultiEdit: when the edited file is under the repo's configured specs folder or the meta-model, run the check; if there are errors, return them to the agent (so it fixes them before going on); stay silent otherwise. It must be fast, never block when Lathe is not installed, and never run outside a repo with `lathe.config.json`.
4. `plugin/README.md`: what it does and how to install it in a product repo.

## Checks
Run the hook script by hand against this repo: once with a clean spec file path (silent), once after copying a record into a temporary copy of the repo with a broken link (reports the error). Do not leave any broken record in the repo. Validate the JSON files parse.
