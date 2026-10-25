# Plan: domains as vertical slices

## Outcome
Lathe's own spec is organized into business-capability domains, each a vertical slice that owns its records and rules, views, engine code and tests. Lathe makes this the standard for every product it models: its format guide, its modeling skill and a check all steer domains toward capabilities and away from technology layers.

## Status
Building (2026-10-25).

## Context
Lathe's spec has four domains cut by deliverable and technology: Browsing (the web app), Checking (the engine), Desktop (the Electron shell) and Modeling (the format and diagrams). As a result:
- one capability, such as coverage, is computed in Checking and designed again in Browsing;
- Browsing keeps hitting the size limits;
- Desktop repeats other domains' use cases for one platform.

S2, the product Lathe is measured against, is organized by business area. Its shared platform lives under Shared, and each domain's design holds its own views, API, components and tests.

## Decisions (Owner)
1. **Domains are vertical slices of business capability.** Technology is a layer inside a domain's Design stage, never a domain.
2. **Lathe's slices:**
   - **Authoring** (`LA-AUT`): the record format, meta-model, diagrams and patterns.
   - **Checking** (`LA-CHK`): the checks, problems and severity.
   - **Traceability** (`LA-TRC`): links in both directions, and designed, built and proved coverage with its gaps and evidence.
   - **Exploring** (`LA-EXP`): reading a product through the wiki, graph and model views, search, tabs and the side bar's content.
   - **Platform** (`LA-PLT`): what every slice shares. That is the app shell and workbench, themes, the server and live reload, and the Electron shell.
3. **Traceability is its own slice.** The checks that report coverage gaps move with it; Checking keeps the format and structure checks.
4. **This is a hard cutover:** new domain IDs, folders and record IDs, with every link, citation, test name and code reference updated together. Nothing keeps the old IDs.
5. **Vertical slices become Lathe's standard,** in FORMAT.md, the generated reference, the plugin's modeling skill, and a check that warns on domains named for a technology.

## Decisions settled by recommendation (for the Owner to review)
- **IDs:** each new domain numbers its records afresh, keeping their old relative order.
- **Platform:** a domain like the others (`specs/lathe/platform/`), not a folder under Shared, so Lathe needs no new kind.
- **Code layout:** `app/`, `lathe/` and `desktop/` stay as they are. The slices are in the spec, and each component's `file` points at its code wherever that lives.
- **Historical notes:** `notes/` (the overnight log, briefs, trials and audits) keeps the old IDs, because they record the past.

## Scope
- **In:** everything under `specs/lathe/`; ID references in `app/`, `lathe/`, `desktop/`, `plugin/` and the READMEs; FORMAT.md, REFERENCE.md and the plugin's modeling skill; a new check.
- **Out:** the Tool Library example, already one business domain; the code folder layout; anything in `notes/`.

## Changes to existing specs
- `specs/lathe/product.md`: lists the five slices.
- Every record under `browsing/`, `checking/`, `desktop/` and `modeling/` moves to one of the five slices, with a new ID.
- `LA-PAT-APP-CODE` and `LA-PAT-APP-UX`: the domains that follow them change.

## Build steps
1. **Brief 75, the standard:** FORMAT.md guidance, the `domain-named-for-technology` check, the reference, and the plugin's modeling skill. Independent of step 2.
2. **Brief 76, the conversion:**
   - a mapping of every record to its slice and new ID, kept as a reviewable table in the scratchpad;
   - a conversion script, then a review that each slice reads as one capability;
   - fixes for every size warning the new shape raises.

   It merges main last, so it also converts the records from briefs 72 and 75.
3. The coordinator merges 75, then 76, runs the full CI, and checks the app.

## Open questions
None.
