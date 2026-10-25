---
id: LA-DSK-DR01
kind: domain_rule
title: A folder opens only when it holds lathe.config.json or a specs folder
parent: LA-DSK-A1
---
A folder MUST open only when it holds a `lathe.config.json` that is valid JSON, or else a `specs/` folder. Any other folder MUST be refused with a message that says what is missing, and no window opens.
