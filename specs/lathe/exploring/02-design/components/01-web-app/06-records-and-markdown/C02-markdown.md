---
id: LA-EXP-C02
kind: component
title: Markdown rendering
parent: LA-EXP-LAY07
component_type: react component
file: app/src/specs/Markdown.tsx
links:
  satisfies: [LA-EXP-UC02-R03, LA-PLT-DR23]
---
Renders a record body (or the format document) from Markdown with `marked`, gives each heading an anchor, and sanitizes the HTML with `dompurify` before it reaches the page.
