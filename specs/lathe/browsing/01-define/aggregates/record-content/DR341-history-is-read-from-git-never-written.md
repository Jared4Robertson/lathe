---
id: LA-BRW-DR341
kind: domain_rule
title: A record's history is read from git, never written
parent: LA-BRW-A11
---
A record's history MUST come from git's own log of its spec file, found from the specs by the record's ID, never from a path a request names. Reading it MUST change nothing: no commit, no lock, no change to the git config, and no command built from text a shell reads. The browser stays read-only (`LA-BRW-DR04`).
