---
id: LA-TRC-C16
kind: component
title: Obligation outside domain check
parent: LA-TRC-LAY03
component_type: sql check
file: lathe/checks/35-obligation-outside-domain.sql
links:
  satisfies: [LA-TRC-UC04-R08, LA-TRC-DR10]
---
The `obligation-outside-domain` check: warns about each record of an obligation kind that sits in no domain, except a pattern rule under a pattern.
