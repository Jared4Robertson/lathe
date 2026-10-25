---
id: LA-CHK-UC25-R05
kind: requirement
title: Lathe's committed reference never goes stale
parent: LA-CHK-UC25
---
Lathe's reference for its defaults MUST be committed as `lathe/REFERENCE.md`, so an agent can read it without running anything. The package build MUST regenerate it, and a test MUST fail when the committed file differs from what `lathe format` writes.
