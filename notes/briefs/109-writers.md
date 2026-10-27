# Brief: the CLI, MCP tools and plugin skills on the new model (step 3)

Read [00-common-rules.md](00-common-rules.md), the plan [notes/plans/domain-model-refinement.md](../plans/domain-model-refinement.md), [notes/store-interfaces.md](../store-interfaces.md) and the Tool Library sheet [notes/conversions/tool-library.md](../conversions/tool-library.md) first. **Base branch: `domain-model`.** Work in your own worktree from it, and finish with your branch ready to merge into `domain-model`.

## Goal
The Owner and the Agent write specs in the new model: the CLI and MCP tools work on every new kind and part, and the plugin's skills teach the new model.

## Decisions (Owner)
- **CLI and MCP tools** keep generating flags, help and input schemas from the schema description. Make them work for kinds with two possible parents, kinds with no owner, part tables (fields, table keys, command changes, actors) and links, and `next-id` for the new ID patterns (parent-scoped, domain-scoped, product-scoped). Refusals print clearly.
- **Skills** are rewritten for the new model: no domain rules, components, layers or generic tests. The modeling skill teaches the event storming order: aggregates, commands and events, then invariants, value objects and their constraints, specifications, policies, read models and queries, domain services and terms; then capabilities, use cases and their requirements; then each use case's flow, its steps, views, endpoints and integrations; then the technical kinds; then the test kinds with their run by. It teaches one aggregate per command, recorded exceptions with reasons, and the outbox for events a policy hears or that are published. Use the Tool Library as the skills' worked example.
- `extend-the-meta-model` covers product kinds in the five stages.

## Owns
`lathe/src/cli/`, `lathe/test/cli/`, the CLI commands' registration in `lathe/bin/lathe.ts`, and `plugin/`. Don't touch the store, the engine, `lathe/data/`, the app or any data.

## Checks
`npm --prefix lathe run typecheck` for your files, `npx vitest run test/cli` in `lathe/` (at most 2 workers), the plugin's own checks, and an end-to-end test that writes a small product in the new model through the CLI (a domain, aggregate, entity with fields, command, event, use case, requirement, flow and step, a test) and loads it. Engine files outside yours may still fail to typecheck until the engine brief merges; list them, don't fix them.

## Report
The common rules' report, plus the commands and tools, and the skills changed.
