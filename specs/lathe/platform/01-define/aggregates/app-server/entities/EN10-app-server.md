---
id: LA-PLT-EN10
kind: entity
title: App server
parent: LA-PLT-A7
role: root
---
What one window loads Lathe from.

## Fields

| Field | Meaning | Kind of value | Example |
| --- | --- | --- | --- |
| Source | Which server it is. | `serve()` in the shell, a Vite dev server the shell starts, or the shared 5199 dev server. | serve() |
| Folder | The product folder it reads. | Folder path. | ~/Development/tool-library |
| Port | Where it answers. | Port number, never 5199 for one the shell starts. | 61234 |
