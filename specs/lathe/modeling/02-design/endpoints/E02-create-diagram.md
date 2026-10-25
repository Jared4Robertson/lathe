---
id: LA-MOD-E02
kind: endpoint
title: Create a diagram
parent: LA-MOD
method: POST
route: "/api/diagrams"
links:
  fulfills: [LA-MOD-UC01-R01, LA-MOD-UC01-R02, LA-MOD-UC01-R03]
---
Request: `{title, description}`. Responses: `201` with `{slug, title, description}`; `400` with `{error}` when the title is empty or the slug already exists.
