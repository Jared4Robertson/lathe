---
id: LA-PLT-C19
kind: component
title: Theme stylesheet
parent: LA-PLT-LAY05
component_type: typescript module
file: app/src/theme/css.ts
links:
  satisfies: [LA-PLT-UC06-R07, LA-PAT-APP-CODE-R15]
  depends_on: [LA-PLT-C18]
---
Writes a theme as token values on `:root[data-theme]`, the dark set under `prefers-color-scheme: dark` unless Light is chosen and under `data-mode="dark"`; `apply.ts` puts it in one `<style>` element and the mode on `<html>`, at once.
