---
id: LA-MOD
kind: domain
title: Modeling
parent: LA
---
How a product's knowledge is written down. Two forms exist side by side:

- **Diagrams**: brainstorm canvases under `model/<slug>/`, each a `terms.csv` and a `links.csv`, registered in `model/diagrams.csv` and drawn by the app's Diagrams pages.
- **Spec records**: one Markdown file per record under `specs/`, with a YAML header for its fields and links, in the format of `lathe/FORMAT.md`.

Both are plain files, so git review, diffs and agent edits keep working.

The two stay separate, with no shared format. A diagram is a canvas for thinking before anything is specified. Once a domain is specified, its picture is drawn from its records (the spec browser's Graph tab), not from a hand-made diagram.
