---
id: LA-BRW-DR202
kind: domain_rule
title: A theme file says its format and version and holds known tokens only
parent: LA-BRW-A9
---
A theme file MUST be JSON with `format` "lathe-theme", `version` 1, a `name` of 1 to 60 characters, and `light`, `dark` and `tokens` objects. A file with any other field, an unknown token, or a value that is not exactly a value of its kind MUST be refused with a message saying why. Core colors a file leaves out MUST be taken from Lathe.
