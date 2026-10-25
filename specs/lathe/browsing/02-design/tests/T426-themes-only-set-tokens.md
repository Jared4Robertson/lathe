---
id: LA-BRW-T426
kind: test
title: "Themes only set tokens: a theme file holds token names only, its stylesheet sets them on :root, and every built-in passes AA"
parent: LA-BRW
test_type: unit
run_by: app/test/standards.test.tsx
links:
  proves: [LA-PAT-APP-CODE-R15]
  covers: [LA-BRW-C190, LA-BRW-C191, LA-BRW-C196]
---
Reads every built-in theme file and expects only token names the stylesheet's `:root` defines; expects each theme's stylesheet to have only `:root` selectors and custom properties; and computes the contrast of ink, muted text and the accent on paper and sheet for every built-in in both modes.
