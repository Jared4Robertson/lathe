---
id: LA-BRW-C191
kind: component
title: Theme stylesheet
parent: LA-BRW-LAY10
component_type: typescript module
file: app/src/theme/css.ts
links:
  satisfies: [LA-BRW-UC114-R07, LA-PAT-APP-CODE-R15]
  depends_on: [LA-BRW-C190]
---
Writes a theme as token values on `:root[data-theme]`, the dark set under `prefers-color-scheme: dark` unless Light is chosen and under `data-mode="dark"`; `apply.ts` puts it in one `<style>` element and the mode on `<html>`, at once.
