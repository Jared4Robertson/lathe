---
id: LA-CHK-DR13
kind: domain_rule
title: Owed or silent proof is a warning, not an error
parent: LA-CHK-A1
---
Proof still owed, a proof that counts nowhere and a manual test whose file is silent MUST each be reported as a warning, never an error: they are work still to do, and `lathe check` MUST NOT fail because of them.
