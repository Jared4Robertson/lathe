---
id: LA-EXP-API01
kind: api
title: History API
parent: LA-EXP
---
A record's git history, at `/api/history`, served by `lathe serve`, the app's Vite plugin and the desktop app alike. It answers JSON, and any method but GET with 405.

## Shapes

| Shape | Meaning | Fields |
| --- | --- | --- |
| History | The commits that touched a record's spec file, newest first, a page at a time. | `state`, `id`, `file`, `uncommitted`, `commits`, `more` |
| Diff | One commit's change to the file, or the changes not committed yet. | `state`, `id`, `file`, `commit`, `diff`, `truncated` |
| Error | A refusal. | `error` (a sentence) |
