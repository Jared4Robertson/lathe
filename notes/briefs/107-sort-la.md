# Brief: sort LA's spec into the new model (step 3, one agent per domain group)

Read [00-common-rules.md](00-common-rules.md), the plan [notes/plans/domain-model-refinement.md](../plans/domain-model-refinement.md), [notes/store-interfaces.md](../store-interfaces.md) and the Tool Library's finished sheet [notes/conversions/tool-library.md](../conversions/tool-library.md) first. The Tool Library is the worked example the Owner reviewed and approved: follow its approach, layout and level of detail. **Base branch: `domain-model`.** Work in your own worktree from it, and finish with your branch ready to merge into `domain-model`.

## Goal
LA is Lathe's own spec (`data/*.jsonl` at the repo root, still in the old shape). It is converted the way the Tool Library was: a sorting sheet first, then one agent applies every sheet together (brief 111), so links across domains line up. Your launch message names your domains. You write their sheet only.

## Decisions (Owner)
- Everything in the plan, and the Tool Library's approach: rules sorted into constraints, invariants, specifications and policies by what they do; use cases kept as goals, with their commands and queries found in the code (`lathe/`, `app/`, `desktop/`, `plugin/`) and flow steps that fulfill every requirement; technical records only for code that really exists, each naming its file; tests split by what they prove, one parent each, every test naming its run by.
- **Describe Lathe as the plan makes it, not as it was.** LA describes Lathe itself. Where a record describes something the plan removes or reshapes (old kinds such as domain rules, components and layers; old relations; the old checks and coverage), write the record for the new model, and list each such rewrite. The engine, writers and app are being rebuilt to the plan at the same time, so the spec should match the plan.
- **Lathe's own technical kinds:** where Lathe's code fits none of the fourteen technical kinds (checks, CLI commands, schema migrations, graph layout and the like), propose a product kind (name, stage, parent, ID pattern) in your sheet. The Owner reviews them with the conversion. Reuse a kind another group proposes if the sheets meet; the apply step reconciles them.
- **Pattern rules and standard rules** are proved by pattern rule tests (one per rule and adopting domain) and by tests or checks named in a run by.
- **IDs follow the plan's patterns.** Keep the old number where a record keeps its role (the Tool Library did, such as E01 to EP01).
- **Every old record and link of your domains is accounted for** in a closing table: where it went, or why it was dropped. Nothing is dropped silently.
- Cross-domain links: name the other domain's new record if you can tell it, or the old ID marked "to resolve", for the apply step.

## Write
`notes/conversions/la-<domain>.md` for each domain your launch message names (lower case, such as `la-aut.md`). Don't touch any other file.

## Report
Counts per new kind, every judgment call and rewrite, proposed product kinds, cross-domain links left to resolve, and anything the plan didn't cover.
