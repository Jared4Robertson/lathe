---
id: LA-PLT
kind: domain
title: Platform
parent: LA
links:
  follows: [LA-PAT-APP-CODE, LA-PAT-APP-UX]
---
What every slice stands on: the app shell and workbench with its panels, commands and keys, themes, the workspace loaded and reloaded live, the server and its API's transport, and the desktop app, a window per product folder around the same web app. Platform follows the two app patterns, App code (`LA-PAT-APP-CODE`) and App experience (`LA-PAT-APP-UX`), and holds the standards, stability, accessibility and performance suites that prove them for the whole app.

The desktop app runs three ways: `npm --prefix desktop run dev` for development, which loads the owner's dev server on port 5199 when it serves the opened folder or else one of its own; `npm --prefix desktop start`, which builds Lathe and runs the shell as it ships; and `npm --prefix desktop run pack`, an unsigned macOS app for this Mac. Signed builds, notarizing, auto-update and Windows and Linux builds come later and need the owner's approval to publish.
