---
id: LA-BRW-UC51-R03
kind: requirement
title: Shortcuts never get in the way of typing or of the browser
parent: LA-BRW-UC51
---
Single-key shortcuts MUST NOT fire while typing; the app MUST call preventDefault only for keys it handles (so Cmd/Ctrl+P never opens the print dialog, and unhandled keys reach the browser); and no binding MUST take a browser essential.
