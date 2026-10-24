---
id: LA-Q02
kind: question
title: "When do specs move into each product's own repo?"
parent: LA
owner: Jared
links:
  about: [LA, LA-CHK-UC04]
---
For now every product's specs live in this repo under `specs/`, and `loadWorkspace(root)` reads one root. The plan is for specs to live in the product's own repo later, as S2's `docs/` does.

Undecided: when to make that move, and how one Lathe instance is pointed at another repo (a root path, a config file, or several roots at once), and whether the meta-model travels with the specs or stays with Lathe.
