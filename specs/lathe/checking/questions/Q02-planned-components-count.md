---
id: LA-CHK-Q02
kind: question
title: "Should a planned component count as satisfying a requirement?"
parent: LA-CHK
owner: Jared
links:
  about: [LA-CHK-DR07, LA-CHK-A2]
---
A component whose `file` does not exist yet is only a warning, and its `satisfies` links still count towards coverage. So a domain can look fully designed before any of its code exists.

That matches S2's "design complete" view (designed, not built), but it hides how much is built. Options: keep it; report built and designed separately; or count only components whose file exists.
