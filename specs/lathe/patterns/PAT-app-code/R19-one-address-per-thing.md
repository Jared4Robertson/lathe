---
id: LA-PAT-APP-CODE-R19
kind: pattern_rule
title: One address per thing
parent: LA-PAT-APP-CODE
---
A record's address MUST be its bare ID (`/LA-BRW-UC01`), a product's and a domain's included, and a group's MUST be its place in the graph's tree: a stage or folder under its domain (`/LA-BRW/define/use-cases`), or a record's group of one kind of child (`/<parent-id>/<kind>`). The app's own pages MUST be lowercase words (`/`, `/checks`, `/format`, `/settings/appearance`), so that no ID, which starts with a capital, can take their address. Every address of a record or group MUST be built by `addressOf` in `app/src/views/address.ts`, the one function that makes them: no other file MAY build such a path by hand. An address that changes form changes everywhere at once, with no redirect from the old one (`LA-PAT-APP-CODE-R20`).
