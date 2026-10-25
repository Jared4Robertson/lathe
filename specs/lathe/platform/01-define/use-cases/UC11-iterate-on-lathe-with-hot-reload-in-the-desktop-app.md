---
id: LA-PLT-UC11
kind: use_case
title: Iterate on Lathe with hot reload in the desktop app
parent: LA-PLT-CAP03
actor: Owner
links:
  applies: [LA-PLT-DR33, LA-PLT-DR34, LA-PLT-DR35]
---
The owner changes Lathe while using it in the desktop app. `npm --prefix desktop run dev` loads the app with hot reload: from the owner's own dev server on port 5199 when it serves the opened folder, so the browser and the shell share it, or from a dev server of the shell's own. Changing the shell itself restarts it, and record changes reload the page in every mode. When they want the app as it ships, they build it locally, unsigned.
