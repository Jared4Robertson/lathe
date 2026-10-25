---
id: LA-BRW-C07
kind: component
title: Markdown rendering
parent: LA-BRW-LAY08
component_type: react component
file: app/src/specs/Markdown.tsx
links:
  satisfies: [LA-BRW-UC03-R03, LA-BRW-DR322]
---
Renders a record body (or the format document) from Markdown with `marked`, gives each heading an anchor, and sanitizes the HTML with `dompurify` before it reaches the page.
