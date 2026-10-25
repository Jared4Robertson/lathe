---
id: LA-PLT-C02
kind: component
title: Reload parse cache and side-by-side checks
parent: LA-PLT-LAY01
component_type: module
file: lathe/src/index.ts
links:
  satisfies: [LA-PLT-DR02, LA-AUT-UC03-R03]
---
In the workspace loader: every record file is read on each load, and parsed only when its text differs from the text last parsed for it (the parse cache, `clearParseCache()` empties it); the files named by tests and components are read side by side; Lathe's checks, then the product's, run on four connections to the same in-memory database and their problems are put back in file order; the four coverage queries run side by side. `loadWorkspace(root, { timings })` fills `timings` with each phase's time and how many files it parsed. `formatReference(root)` keeps its answer while the meta-model folders, the check folders, `FORMAT.md` and `lathe.config.json` are unchanged, by size and modification time.
