---
id: LA-BRW-C07
kind: component
title: Markdown rendering
parent: LA-BRW
component_type: react component
file: app/src/specs/Markdown.tsx
links:
  satisfies: [LA-BRW-UC03-R03]
---
Renders a record body (or the format document) from Markdown with `marked`, gives each heading an anchor, and sanitises the HTML with `dompurify` before it reaches the page.
