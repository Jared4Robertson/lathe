---
id: LA-PLT-DR40
kind: domain_rule
title: macOS keeps no window state for Lathe
parent: LA-PLT-A6
---
The app MUST opt out of macOS window restoration (`ApplePersistenceIgnoreState`, `NSQuitAlwaysKeepsWindows`), since it reopens its own windows, so a run that was killed leaves macOS nothing to offer to reopen.
