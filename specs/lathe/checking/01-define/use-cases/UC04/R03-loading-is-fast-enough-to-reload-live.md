---
id: LA-CHK-UC04-R03
kind: requirement
title: Loading is fast enough to reload live
parent: LA-CHK-UC04
---
`loadWorkspace(root)` MUST load Lathe's own spec in under 2 s, and load it again after one record file changes in under 500 ms (`LA-CHK-DR310`), so the app and an agent's script can reload on every save. It MAY take `timings` in its options, which it fills with how long each phase took (parse, files, load, checks, coverage, total) and how many files it parsed anew.
