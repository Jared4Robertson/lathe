---
id: LA-CHK-UC05
kind: use_case
title: Change the meta-model
parent: LA-CHK-CAP03
actor: Jared
links:
  applies: [LA-CHK-DR01, LA-CHK-DR02, LA-CHK-DR10, LA-CHK-DR32]
---
Jared adds a kind of record or allows a new relation, for example a `fitness` kind, by editing `lathe/meta/*.csv`, and the change is reviewed in git like any other. A product changes its own meta-model the same way in its `metaExtensions` folder, adding kinds or widening Lathe's (`LA-CHK-UC09`). The app does not edit the meta-model. The next `lathe check` shows both records the change breaks and any mistake in the meta-model itself.
