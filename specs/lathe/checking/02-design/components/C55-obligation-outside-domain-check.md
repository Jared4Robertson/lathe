---
id: LA-CHK-C55
kind: component
title: Obligation outside domain check
parent: LA-CHK
component_type: sql check
file: lathe/checks/35-obligation-outside-domain.sql
links:
  satisfies: [LA-CHK-UC11-R08, LA-CHK-DR53]
---
The `obligation-outside-domain` check: warns about each record of an obligation kind that sits in no domain, except a pattern rule under a pattern.
