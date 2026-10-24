---
id: LA-MOD-E03
kind: endpoint
title: Get one diagram with its check result
parent: LA-MOD
method: GET
route: "/api/diagrams/<slug>"
links:
  fulfills: [LA-MOD-UC02-R02]
---
Responses: `200` with `{terms, links, checks: {ok, message}}`, where `checks` is the result of running `model/checks.sql` against the diagram; `404` with `{error}` when no diagram has that slug.
