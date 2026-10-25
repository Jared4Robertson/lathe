---
id: LA-DSK-DR04
kind: domain_rule
title: The page reaches the shell only through window.latheDesktop
parent: LA-DSK-A1
---
Every window MUST run its page with context isolation and the sandbox on and Node integration off. The preload MUST expose only `window.latheDesktop` with `isDesktop`, `platform` and `onCommand`, and nothing of Node or Electron.
