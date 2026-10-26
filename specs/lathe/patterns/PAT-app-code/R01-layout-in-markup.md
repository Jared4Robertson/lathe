---
id: LA-PAT-APP-CODE-R01
kind: pattern_rule
title: Layout lives in the markup
parent: LA-PAT-APP-CODE
group: Markup and style
---
A component MUST render its own structure: the rows, columns and slots its parts sit in. A stylesheet MUST NOT move an element into another element's box or restyle it from outside its component, so no `display: contents` and no `:has()`. When a control from further down belongs in a heading's row, the heading offers a slot and the control renders into it, as a section's header row holds its list's Expand all.

Absolute positioning stays for marks and decorations inside a component's own box, such as a graph node's chevron.
