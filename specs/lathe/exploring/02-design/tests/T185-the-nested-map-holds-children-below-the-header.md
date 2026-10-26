---
id: LA-EXP-T185
kind: test
title: "The Nested map holds each box's children below its header band, every box a square sized to its content"
parent: LA-EXP
test_type: unit
run_by: app/test/graph/nested.test.ts
links:
  proves: [LA-EXP-DR62]
---
Lays out the test workspaces and synthetic trees and expects every child inside its parent below the header band, siblings never overlapping, a parent before its children in the keyboard's order, and the same roots and children as the Tree map; every box a square, a synthetic leaf the least square for its label and a parent no bigger than its header, its children's block and its padding need (give or take the header line its least width saves); and a box of three leaves bigger than a box of one.
