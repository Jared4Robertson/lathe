---
id: LA-EXP-T186
kind: test
title: Children are a grid of equal squares in the tree's order, with the column count that makes them largest
parent: LA-EXP
test_type: unit
run_by: app/test/graph/nested.test.ts
links:
  proves: [LA-EXP-DR62]
---
Expects four squares in a square room to be two by two, five in a wide room one row, three in a square room two columns with a blank cell and the gap taken off the side, no column count giving larger squares than the one chosen, and in every test map each parent's children in the tree's order, row by row, a gap apart.
