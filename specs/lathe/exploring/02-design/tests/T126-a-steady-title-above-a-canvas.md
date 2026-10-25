---
id: LA-EXP-T126
kind: test
title: Above a graph or a model pane the page title keeps one fixed height; in the wiki pane it wraps
parent: LA-EXP
test_type: component
run_by: app/test/model.test.tsx
links:
  proves: [LA-EXP-UC05-R13]
---
Opens an aggregate in the Graph view and an entity in the Model view and expects the title area to have the fixed-height class, with the whole title as its tooltip and a set height, one line each, in the stylesheet; with the wiki open on the left it does not.
