---
id: LA-AUT-API01
kind: api
title: Format API
parent: LA-AUT
---
The product's format reference, at `/api/format`, served by `lathe serve` and the app's Vite plugin alike, for the app's format pages. It answers JSON, and any method but GET with 405.

## Shapes

| Shape | Meaning | Fields |
| --- | --- | --- |
| Format reference | Every kind, relation, folder and check of the product, as `lathe/src/reference.ts` builds it. | `concepts`, `kinds`, `relations`, `sections`, `checks` |
| Error | A refusal. | `error` (a sentence) |
