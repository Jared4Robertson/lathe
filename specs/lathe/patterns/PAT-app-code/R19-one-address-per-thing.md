---
id: LA-PAT-APP-CODE-R19
kind: pattern_rule
title: One address per thing
parent: LA-PAT-APP-CODE
---
A record's address MUST be its bare ID (`/LA-BRW-UC01`), a product's and a domain's included, and a group's MUST be its parent's ID and its kind (`/LA-BRW/use_case`), with the parts of a group within it after the kind. The app's own pages MUST be lowercase words (`/`, `/checks`, `/format`, `/settings/appearance`, `/diagrams/<slug>`), so that no ID, which starts with a capital, can take their address. Every address of a record or group MUST be built by `addressOf` in `app/src/views/address.ts`, the one function that makes them: no other file MAY build such a path by hand. An address that changes form changes everywhere at once, with no redirect from the old one (`LA-PAT-APP-CODE-R20`).
