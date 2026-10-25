---
id: LA-CHK-UC15
kind: use_case
title: Add a product's own checks
parent: LA-CHK-CAP04
actor: Owner, Agent
links:
  applies: [LA-CHK-DR90, LA-CHK-DR91, LA-CHK-DR92, LA-CHK-DR94]
---
A product has house rules that Lathe should not impose on every product. S2, for example, requires each aggregate to have exactly one use case that follows its Record view pattern, and this repo requires every endpoint to state at least one interaction requirement. Lathe ships no such rule. Instead the owner, or an agent, names a `checks` folder in the product's `lathe.config.json` and writes each rule there as one SQL file, in the same form as Lathe's own checks. `lathe check` runs them after Lathe's checks and reports their problems with the others, so the product's rules live and change with the product.
