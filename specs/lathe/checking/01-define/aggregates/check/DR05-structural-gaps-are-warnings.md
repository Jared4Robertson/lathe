---
id: LA-CHK-DR05
kind: domain_rule
title: A structural gap is a warning, not an error
parent: LA-CHK-A1
---
A check that finds two stages not joined up (a rule no use case applies, a use case no flow carries out, an interaction requirement that fulfills nothing, a test whose type does not suit what it proves) MUST report a warning, never an error: it is work still to do, and `lathe check` MUST NOT fail because of it.
