---
id: LA-BRW-DR04
kind: domain_rule
title: Spec pages only read records
parent: LA-BRW-A1
---
A spec page MUST NOT create, change or delete a record, and MUST NOT offer a control that would. It only reads the workspace (`GET /api/spec`). Records change in their files, by a person or an agent, so every change is reviewed in git.
