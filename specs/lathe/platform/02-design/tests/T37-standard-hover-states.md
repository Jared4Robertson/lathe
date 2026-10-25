---
id: LA-PLT-T37
kind: test
title: "Everything clickable shows a hover state: each pointer-cursor rule has a :hover rule for the same class"
parent: LA-PLT
test_type: unit
run_by: app/test/standards.test.tsx
links:
  proves: [LA-PAT-APP-UX-R01]
---
Reads every style rule in `app/src/styles.css` that sets a pointer cursor and expects a `:hover` rule naming the same class, and expects the shared hover tokens to be defined.
