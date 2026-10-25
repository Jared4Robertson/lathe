---
id: LA-PLT-UC11-R05
kind: requirement
title: A local build is unsigned and stays on this Mac
parent: LA-PLT-UC11
---
`npm --prefix desktop run pack` MUST build Lathe first, then an unsigned macOS app for this Mac's architecture in `desktop/release/`, which git ignores. It MUST NOT sign, notarize, publish or add auto-update.
