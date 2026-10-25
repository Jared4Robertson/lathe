---
id: LA-PLT-T35
kind: test
title: "Colors and shadows are tokens: color values appear only where :root defines them"
parent: LA-PLT
test_type: unit
run_by: app/test/standards.test.tsx
links:
  proves: [LA-PAT-APP-CODE-R03]
---
Expects no hex, `rgb()` or `hsl()` value in any style rule outside `:root`, and no color in a component's inline style.
