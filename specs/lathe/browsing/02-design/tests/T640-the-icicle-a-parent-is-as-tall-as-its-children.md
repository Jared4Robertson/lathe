---
id: LA-BRW-T640
kind: test
title: "The icicle: a parent is as tall as its children stacked, each child beside it"
parent: LA-BRW
test_type: unit
run_by: app/test/graph/icicle.test.ts
links:
  proves: [LA-BRW-DR330, LA-BRW-UC40-R08]
---
Lays out a domain, a stage, a record and a crowded folder at depths 1 to 3, with Links off and on, and expects each parent with drawn children to be exactly as tall as their stack, gaps included, starting at its top edge, in tree order; leaves and chips one node high; at depth 1 the parent as tall as the center; the center's middle at the origin; no two boxes overlapping, records the Links switch brings included; one x per column; a trace's columns all leaf-high; and the same layout every time.
