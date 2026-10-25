---
id: LA-CHK-A1
kind: aggregate
title: Check
parent: LA-CHK
---
One rule the engine applies, written as one SQL file in `lathe/checks/`, for example `lathe/checks/01-duplicate-id.sql`. It reads the loaded tables and returns rows of `(severity, check, record, message)`.
