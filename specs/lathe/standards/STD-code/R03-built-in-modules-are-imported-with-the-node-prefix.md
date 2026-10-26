---
id: LA-STD-CODE-R03
kind: standard_rule
title: Built-in modules are imported with the node prefix
parent: LA-STD-CODE
---
The engine, the server, the desktop app and their tests MUST import Node's built-in modules by their `node:` name, such as `node:fs` or `node:child_process`, never by the bare name.
