# Plan: package Lathe as a tool installed into a product's repo

## Outcome
A product repo installs Lathe and runs `lathe init`, `lathe check` and `lathe serve`. Its specs live in its own `specs/` folder, beside its code. Lathe's improvements reach every product through a version bump. A GitHub Action and a Claude Code plugin are thin layers on the same engine.

## Status
Agreed. Building after the spec-store branches are merged and verified.

## Context
Today Lathe is one repo that mixes the tool (`lathe/` engine, `app/` web app) with content (`specs/`, `examples/`, `model/`). Copying the repo per product would make every copy drift from Lathe's improvements, which works against a tool meant to improve itself.

## Decisions
| Decision | Decided by |
| --- | --- |
| The core is an installable package (engine, CLI and web app together); CI and an agent plugin are thin layers over it. | Jared |
| Until the format settles, Lathe stays one repo, with a clean boundary between tool (`lathe/`, `app/`) and content (`specs/`, `examples/`, `model/`). | Jared |
| The meta-model ships as defaults, and a product extends it in its own config, without forking Lathe. | Jared |
| Lathe dogfoods itself by running its own package, from source, against `specs/lathe/`. | Jared |

## Scope
In: one package `lathe` exposing the CLI commands `init`, `check` (with `--json`) and `serve`; a `lathe.config.json` in the product repo naming the specs folder, the meta-model extensions, and the code roots that test IDs are traced in; the web app served by `lathe serve` against the product repo's files.

Out, for later: publishing to npm, the GitHub Action, the Claude Code plugin, a hosted service.

## Changes to existing specs
- [lathe/FORMAT.md](../../lathe/FORMAT.md): describe `lathe.config.json` and where specs live in a product repo.
- [specs/lathe](../../specs/lathe): Lathe's own use cases gain "Set up Lathe in a product" and "Extend the meta-model".

## Build steps
1. Move the web app's server code to read the workspace root from configuration instead of assuming this repo's layout.
2. Add `lathe.config.json` loading to the engine, with defaults when the file is absent; merge product meta-model extensions over the shipped defaults.
3. Add the CLI commands `init` (writes a config and a starter product record), `check` and `serve` (starts the web app for the given root).
4. Make the package installable locally (`npm pack`, or a workspace link) and try it in a scratch product repo created from the Tool Library example.
5. Update Lathe's own spec and FORMAT.md.

## Open questions
| Question | Recommendation | Owner |
| --- | --- | --- |
| Do the `model/` CSV diagrams become spec records, or stay as a separate brainstorm feature? | Keep them separate until the spec browser's graph view exists, then decide. | Jared |
| Package name: `lathe` is likely taken on npm. | Use a scoped name, such as `@jaredrob/lathe`, when publishing. | Jared |
