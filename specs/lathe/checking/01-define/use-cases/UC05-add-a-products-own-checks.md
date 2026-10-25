---
id: LA-CHK-UC05
kind: use_case
title: Add a product's own checks
parent: LA-CHK-CAP01
actor: Owner, Agent
links:
  applies: [LA-CHK-DR08, LA-CHK-DR09, LA-CHK-DR10, LA-CHK-DR11]
---
A product has house rules that Lathe should not impose on every product. One product, for example, requires each aggregate to have exactly one use case that follows its Record view pattern, and this repo requires every endpoint to state at least one interaction requirement. Lathe ships no such rule. Instead the owner, or an agent, names a `checks` folder in the product's `lathe.config.json` and writes each rule there as one SQL file, in the same form as Lathe's own checks. `lathe check` runs them after Lathe's checks and reports their problems with the others, so the product's rules live and change with the product.
