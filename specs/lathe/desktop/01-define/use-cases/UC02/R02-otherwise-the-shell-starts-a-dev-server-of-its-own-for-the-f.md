---
id: LA-DSK-UC02-R02
kind: requirement
title: Otherwise the shell starts a dev server of its own for the folder
parent: LA-DSK-UC02
---
When 5199 does not answer, or answers for another folder, the shell MUST start the app's Vite dev server on a free port with `LATHE_ROOT` set to the opened folder, and load it. The dev API plugin MUST read its product folder from `LATHE_ROOT`, defaulting to Lathe's own repo, so the owner's 5199 server is unchanged.
