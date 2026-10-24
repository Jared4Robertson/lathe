---
id: LA-MOD-E03-R01
kind: interaction_requirement
title: GET /api/diagrams/<slug> answers with the diagram and its check result, or 404
parent: LA-MOD-E03
links:
  fulfills: [LA-MOD-UC02-R02]
---
For a registered slug, the response MUST be 200 with `{terms, links, checks: {ok, message}}`, where `checks` is the result of `lathe/diagrams/checks.sql` for that diagram, broken or not. For a slug that is malformed, unknown or not registered, the response MUST be 404 with `{error}`.
