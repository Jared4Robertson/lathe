---
id: LA-BRW-UC05-R01
kind: requirement
title: Spec pages reload when records or the engine's rules change
parent: LA-BRW-UC05
---
When a file in the product's specs folder, or one of Lathe's checks or meta-model files, changes, the server SHOULD send `spec:changed`, and the open spec page SHOULD then load the workspace again without a manual refresh, staying at the same address.
