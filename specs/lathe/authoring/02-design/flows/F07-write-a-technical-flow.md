---
id: LA-AUT-F07
kind: flow
title: Write a technical flow and check it
parent: LA-AUT-CAP03
links:
  carries_out: [LA-AUT-UC17]
---
1. An agent, or the owner, writes a `design_flow` in the layer that does most of the work, with `deepens` naming the flow.
2. They write one `design_step` per step under it, in order and on its path, with the component it `uses`, what it `satisfies`, and its transaction, locks and statements.
3. They run `lathe check`, which reports step orders that clash or skip as `step-order` errors, a technical flow that deepens nothing as a warning, and counts each step's `satisfies` as design.
