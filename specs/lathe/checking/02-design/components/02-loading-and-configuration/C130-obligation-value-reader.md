---
id: LA-CHK-C130
kind: component
title: Obligation value reader
parent: LA-CHK-LAY02
component_type: loader
file: lathe/src/index.ts
links:
  satisfies: [LA-CHK-UC19-R04, LA-CHK-DR134]
---
In `loadMeta`, reads each kind's `obligation` value in any letter case: `yes` or `true` is an obligation, `proof` an obligation with `proof_only` set, and anything else not one. The merged value of a widened kind is read the same way.
