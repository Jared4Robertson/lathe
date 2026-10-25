---
id: LA-PAT-APP-CODE-R20
kind: pattern_rule
title: Changes are hard cutovers
parent: LA-PAT-APP-CODE
---
When something is renamed or reshaped (an address, a function's signature, a command ID, a stored key, a class, a column or a label), every call site, record and test MUST move to the new form in the same change, and the old form MUST be deleted. The code MUST NOT keep redirects, aliases, second signatures, upgrades of saved state, or old names kept to avoid churn. Saved state in an old form is dropped: a stored entry that is not valid today is ignored, never converted.
