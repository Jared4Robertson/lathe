---
id: LA-AUT-UC06-R04
kind: requirement
title: A use case left outside the capabilities is a warning
parent: LA-AUT-UC06
---
When a domain has at least one capability, the engine MUST report a `use-case-outside-capability` warning for each of its use cases that sits directly under the domain. A domain with no capabilities MUST NOT be reported.
