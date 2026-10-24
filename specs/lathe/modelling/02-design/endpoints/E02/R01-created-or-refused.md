---
id: LA-MOD-E02-R01
kind: interaction_requirement
title: POST /api/diagrams answers 201 with the new diagram, or 400 with the reason
parent: LA-MOD-E02
links:
  fulfills: [LA-MOD-UC01-R01, LA-MOD-UC01-R03]
---
Given `{title, description}`, the response MUST be 201 with `{slug, title, description}` for the diagram it created, with the title and description trimmed and the description empty when none was given. When the title is empty, has no letter or number, or its slug is taken, the response MUST be 400 with `{error}` saying why, and nothing is written.
