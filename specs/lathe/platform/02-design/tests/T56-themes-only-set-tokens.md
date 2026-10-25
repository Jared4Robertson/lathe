---
id: LA-PLT-T56
kind: test
title: "Themes only set tokens: a theme file holds token names only, its stylesheet sets them on :root, and every built-in passes AA"
parent: LA-PLT
test_type: unit
run_by: app/test/standards.test.tsx
links:
  proves: [LA-PAT-APP-CODE-R15]
  covers: [LA-PLT-C18, LA-PLT-C19, LA-PLT-C24]
---
Reads every built-in theme file and expects only token names the stylesheet's `:root` defines; expects each theme's stylesheet to have only `:root` selectors and custom properties; and computes the contrast of ink, muted text and the accent on paper and sheet for every built-in in both modes.
