---
id: LA-AUT-UC03
kind: use_case
title: Change the meta-model
parent: LA-AUT-CAP02
actor: Owner
links:
  applies: [LA-AUT-DR08, LA-AUT-DR09, LA-AUT-DR10, LA-AUT-DR11, LA-AUT-DR14]
---
The owner adds a kind of record or allows a new relation, for example a `glossary_term` kind, by editing `lathe/meta/*.csv`, and the change is reviewed in git like any other. A product changes its own meta-model the same way in its `metaExtensions` folder, adding kinds or widening Lathe's (`LA-AUT-UC04`). The app does not edit the meta-model. The next `lathe check` shows both records the change breaks and any mistake in the meta-model itself.
