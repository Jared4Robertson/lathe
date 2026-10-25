---
id: LA-TRC-C24
kind: component
title: Obligation value reader
parent: LA-TRC-LAY02
component_type: loader
file: lathe/src/index.ts
links:
  satisfies: [LA-TRC-UC07-R04, LA-AUT-DR33]
---
In `loadMeta`, reads each kind's `obligation` value in any letter case: `yes` or `true` is an obligation, `proof` an obligation with `proof_only` set, and anything else not one. The merged value of a widened kind is read the same way.
