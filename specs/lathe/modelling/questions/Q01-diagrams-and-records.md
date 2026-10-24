---
id: LA-MOD-Q01
kind: question
title: "How do diagrams and spec records relate?"
parent: LA-MOD
owner: Jared
links:
  about: [LA-MOD-A1, LA-MOD-A2]
---
Diagrams (CSV terms and links under `model/`) and spec records (Markdown under `specs/`) both describe a domain, with separate formats, checks and pages. For now the diagrams stay as brainstorm canvases.

Options:

- Keep them separate: diagrams for thinking, records for the decided spec.
- Link them: a record (for example an aggregate) names the diagram term it came from, and the check reports terms with no record.
- Generate one from the other: draw a domain's records as a diagram (the browser's Graph tab stretch goal), and retire hand-made diagrams once a domain is specified.
- Merge them: make diagram terms and links into records, with one meta-model and one engine.
