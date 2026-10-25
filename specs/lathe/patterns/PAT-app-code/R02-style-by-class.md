---
id: LA-PAT-APP-CODE-R02
kind: pattern_rule
title: Styles are set by class
parent: LA-PAT-APP-CODE
---
A style rule MUST select by class, attribute or ID. A selector that names only elements, such as `header`, MUST NOT be used outside the base styles, because it reaches every such element on every page, including ones added later. The base styles may set the page and its plain text and controls: `html`, `body`, headings, paragraphs, links, code, and form controls.
