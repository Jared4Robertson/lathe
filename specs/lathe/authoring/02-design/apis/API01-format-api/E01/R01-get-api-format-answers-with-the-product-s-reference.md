---
id: LA-AUT-E01-R01
kind: interaction_requirement
title: GET /api/format answers with the product's reference as JSON
parent: LA-AUT-E01
links:
  fulfills: [LA-AUT-UC11-R04]
---
The response MUST be 200 with `content-type: application/json` and the `FormatReference` that `formatReference` builds for the product root, extensions included.
