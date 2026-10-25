---
id: LA-CHK-UC10
kind: use_case
title: Organize a domain's use cases into capabilities and patterns
parent: LA-CHK-CAP03
actor: Jared, AI agent
links:
  applies: [LA-CHK-DR40, LA-CHK-DR41, LA-CHK-DR42, LA-CHK-DR43, LA-CHK-DR44]
---
A domain has grown past a handful of use cases, and several of them share the same behavior. The person groups the domain's use cases into ordered **capabilities** (such as 01 Membership, 02 Catalog, 03 Lending) and moves the domain's flows and acceptance tests under the same capabilities, so that each capability is a slice through Define and Design. Behavior that several use cases share is written once as a **pattern** under the product, with named settings or none; each use case that follows it links it with `follows` and gives every setting a value, or `Not applicable:` and a reason, instead of restating its rules. A whole domain may follow a pattern too (LA-CHK-UC19). `lathe check` then reports a clashing or malformed order, a use case left outside the capabilities, and a setting a use case has not given.

Lathe checks only how patterns are used, not house rules about them: a rule such as S2's "each aggregate has exactly one use case following its Record view pattern" is the product's own check (LA-CHK-UC15).
