---
id: LA-DSK-UC02
kind: use_case
title: Iterate on Lathe with hot reload in the desktop app
parent: LA-DSK-CAP01
actor: Jared
links:
  applies: [LA-DSK-DR08, LA-DSK-DR09, LA-DSK-DR10]
---
Jared changes Lathe while using it in the desktop app. `npm --prefix desktop run dev` loads the app with hot reload: from his own dev server on port 5199 when it serves the opened folder, so the browser and the shell share it, or from a dev server of the shell's own. Changing the shell itself restarts it, and record changes reload the page in every mode. When he wants the app as it ships, he builds it locally, unsigned.
