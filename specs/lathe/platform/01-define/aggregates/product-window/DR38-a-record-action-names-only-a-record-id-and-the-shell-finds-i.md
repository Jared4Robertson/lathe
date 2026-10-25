---
id: LA-PLT-DR38
kind: domain_rule
title: A record action names only a record ID, and the shell finds its file
parent: LA-PLT-A6
---
The main process MUST accept a record action only as exactly `{ action, id }`, a known action and an ID in the record ID format, from a product window's own page. It MUST find the spec file itself among the folder's spec files and MUST NOT open, reveal or run anything a page names as a path.
