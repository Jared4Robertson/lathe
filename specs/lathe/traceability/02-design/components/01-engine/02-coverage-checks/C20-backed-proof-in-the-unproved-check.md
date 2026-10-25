---
id: LA-TRC-C20
kind: component
title: Backed proof in the unproved check
parent: LA-TRC-LAY03
component_type: sql check
file: lathe/checks/16-unproved.sql
links:
  satisfies: [LA-TRC-DR15]
---
The unproved check counts an automated test's proof only when its file backs it, with the same rule as the coverage queries in `lathe/src/coverage.ts`: the file names the test's own ID or its key, or names the target.
