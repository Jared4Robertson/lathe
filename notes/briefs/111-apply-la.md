# Brief: apply LA's sorting sheets to its data (step 3)

Read [00-common-rules.md](00-common-rules.md), the plan [notes/plans/domain-model-refinement.md](../plans/domain-model-refinement.md), [notes/store-interfaces.md](../store-interfaces.md), the Tool Library sheet and LA's five sheets in [notes/conversions/](../conversions/) (`la-aut.md`, `la-chk.md`, `la-trc.md`, `la-exp.md`, `la-plt.md`) first. **Base branch: `domain-model`.** Work in your own worktree from it, and finish with your branch ready to merge into `domain-model`.

## Goal
Write LA's spec (`data/*.jsonl` at the repo root) in the new model from the five sheets, as one consistent product: cross-domain links resolved, product-scoped IDs settled, and `lathe check` with 0 errors. Also write a machine-readable map from every old ID to its new one, so that the code's ID mentions can be renamed package by package afterwards (that's not your job).

## Decisions (Owner)
1. **Lathe declares 8 product kinds** (through `product_kind`, `product_kind_field` and, where needed, `product_relation`):
   - `cli_command` (interaction design, under the command or query it exposes, ID `<operation>-CLI`, fields `usage`, `mcp_tool`, `file`): a CLI command, like an endpoint.
   - `ipc_channel` (interaction design, under the command or query it exposes, ID `<operation>-IPC`, field `file`): how the desktop page asks the shell.
   - `skill` (interaction design, under a domain, ID `<P>-<D>-SK<nn>`, field `file`): a plugin skill.
   - `check_row` (technical specification, under a domain, ID `<P>-<D>-CK<nn>`, field `file`): a check row of Lathe's own.
   - `api_client` (technical specification, under an endpoint, ID `<endpoint>-CL`, field `file`).
   - `entry_point` (technical specification, under a domain, ID `<P>-<D>-ENTRY<nn>`, field `file`).
   - `tooling` (technical specification, under a domain, ID `<P>-<D>-TOOL<nn>`, field `file`): a dev script or config file outside the running app.
   - `plugin_hook` (technical specification, under an integration, ID `<integration>-HK<nn>`, field `file`).
   Where a sheet proposed another shape (a `cli_handler`, an `exposes` relation, a `tooling` under a requirement), map it onto these.
2. **Authoring is one aggregate, Product (LA-AUT-A1),** with its entities, as `la-aut.md` has it.
3. **Decided by the coordinator from the sheets' open items:**
   - **Published events:** Authoring's Record changed and Schema changed, Checking's Check changed and Platform's Data written are published. Platform's Workspace read model, and any other read model built from another domain's data, is linked to those events with `fed_by`.
   - **One write path:** Platform's "Apply a write" command (CMD18) goes. The write endpoint exposes Authoring's "Apply several changes as one", and other domains' write steps invoke Authoring's commands.
   - **Exploring follows the app patterns** (it is app UI), so its pattern rule tests stand and it owes their rules.
   - **Screen behavior is view requirements** in every domain, as most sheets did; Exploring's remaining unit-level use case tests become view tests of those requirements.
   - **Every use case keeps at least one UC requirement** stating its outcome, with a use case test at a level its kind allows (e2e-ui or manual where only the app shows it).
   - **Policy tests may also run at e2e-ui or manual.** Change the allowed levels in `lathe/src/coverage.ts` (only that table) and its reference text.
   - **Standard rules are proved by tests that `meets` them,** as the engine defines.
   - **Product-scoped numbers keep the sheets' blocks** (AUT 01–18, CHK 41–49, TRC 51–59, PLT 61–89, EXP its own); resolve any clash.
4. **Restore two tests the engine step dropped** while LA couldn't load: every rule statement in LA's spec says MUST, SHOULD or MAY (LA-AUT-T11), and the modeling skill check (LA-AUT-T13), under their new IDs.

## Build
- Write the data only through the command layer: the CLI (`node lathe/bin/lathe.ts …`) or the store's functions from a one-time script you don't commit. Delete LA's old data files of removed tables.
- Write `notes/conversions/la-id-map.json`: `{ "<old id>": "<new id>" | null }` for every old LA record ID (null for a dropped one), plus the Tool Library's from its sheet. Sort the keys.
- Update the five sheets only where you resolved something, briefly.

## Owns
`data/` (LA's), `notes/conversions/`, the allowed-levels table in `lathe/src/coverage.ts` with its reference text, and the two restored tests in `lathe/test/`. Don't touch other code, `app/`, `desktop/`, the plugin or the Tool Library. The app step (110) is still running beside you.

## Checks
- LA's data loads with every constraint.
- `node lathe/bin/lathe.ts check` at the repo root: 0 errors. Warnings that only say a test file doesn't name its new test ID, or a technical record's file doesn't name its record, are expected until the code is renamed: count them by check, don't fix code.
- `npm --prefix lathe run typecheck` and the lathe tests you touched.

## Report
The common rules' report, plus counts per kind, every resolution you made, `lathe check`'s summary by check, and the coverage summary.
