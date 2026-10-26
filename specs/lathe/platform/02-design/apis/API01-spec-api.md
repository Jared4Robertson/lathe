---
id: LA-PLT-API01
kind: api
title: Spec API
parent: LA-PLT
---
The loaded workspace, at `/api/spec`, served by `lathe serve`, the app's Vite plugin and the desktop app alike. It answers JSON, and any method but GET with 405.

## Shapes

| Shape | Meaning | Fields |
| --- | --- | --- |
| Workspace | The whole spec, as `lathe/src/types.ts` defines it. | `kinds`, `sections`, `relations`, `records`, `links`, `problems`, `coverage` |
| Error | A refusal. | `error` (a sentence) |
