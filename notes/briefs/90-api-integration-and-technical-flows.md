# Brief: API and integration kinds; technical flows

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main`. Work in your own worktree, and finish with your branch ready to merge. Source: notes/trials/s2-trial-4.md, sections 4.2 and 4.6 (findings only; never copy client text).

## Decisions (made by the coordinator on the owner's standing instruction; apply them)
1. **`api`** (Design, interaction design, parent: domain): a group of endpoints for one resource. It holds `endpoint` records, and `interaction_requirement`s that hold for every endpoint in it. Its body may hold a "Shapes" table of shared request and response shapes.
2. **`integration`** (Design, interaction design, parent: domain): an outside system the domain exchanges with. It holds `interaction_requirement`s, one per exchange, and may have a `system` field naming the outside system.
3. **`interaction_requirement` may also sit directly under a domain** for rules shared across the domain's interaction design.
4. **Technical flows:**
   - `design_flow` (Design, technical specification, parent: domain or layer) `deepens` a `flow`: how the system carries the flow out.
   - Its steps are `design_step` records, each with an `order`, an optional `path` (as flow steps have) and optional `transaction`, `locks` and `statements` fields.
   - Each step `uses` a component and may `satisfies` obligations; a step's `satisfies` counts as design.
   - Failure, limits and signals stay as body tables.
   - Reuse the flow-step checks for order and path, generalized to both kinds, and add `design-flow-deepens-nothing` (warning).
5. **The app:**
   - an API's page lists its endpoints and shared requirements;
   - an integration's page lists its exchanges;
   - a technical flow reads as a step table per path, with each step's component and what it satisfies;
   - the nav, graph and folders place each new kind in its stage folder.
   
   Every new kind gets a graph shape in the key, a plain box being fine for now (brief 88 adds the shapes), and a format reference page from the meta-model.
6. **Dogfood:**
   - Lathe's endpoints (the spec, history and format endpoints) go under an API record in the slice they belong to.
   - At least one Lathe flow gets a technical flow, for example loading and checking a workspace, with steps that use real components.
   - The Tool Library gets an API record for its endpoints.

## Scope
`lathe/meta/kinds.csv`, `relations.csv` and `sections.csv`; the checks; `lathe/src` (coverage counts design-step satisfies); app pages; FORMAT.md and REFERENCE.md; the plugin skills; and specs in Authoring and the relevant slices. IDs continue from the highest per kind and slice. Briefs 89 and 91 run alongside and also touch the meta-model CSVs and FORMAT.md; merge main before reporting and keep both sides.

## Checks
The full checks, plus the stability and a11y suites, once each with one worker. Gate on real exit codes. Never use port 5199.

## Report
The branch and its last commit, what changed, the dogfood records, the checks you ran and their results, and anything left open.
