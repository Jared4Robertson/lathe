---
id: LA-CHK-Q03
kind: question
title: "Should the meta-model be checked like records are?"
parent: LA-CHK
owner: Jared
links:
  about: [LA-CHK-DR02]
---
`LA-CHK-DR02` says the meta-model refers only to kinds it defines, but no check enforces it, and the brief for the engine does not ask for one. A mistake in `kinds.csv` would show up only indirectly, as many record errors.

Should there be meta-model checks in `lathe/checks/`, or is the meta-model trusted because it changes rarely and is reviewed by hand?
