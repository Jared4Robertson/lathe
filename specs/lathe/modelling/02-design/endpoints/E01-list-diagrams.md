---
id: LA-MOD-E01
kind: endpoint
title: List diagrams
parent: LA-MOD
method: GET
route: "/api/diagrams"
links:
  fulfills: [LA-MOD-UC02-R01]
---
Returns the rows of `model/diagrams.csv` as JSON: `[{slug, title, description}]`. The app builds its Diagrams menu from this.
