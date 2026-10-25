---
id: LA-CHK-DR350
kind: domain_rule
title: A domain is named for a capability, not a technology
parent: LA-CHK-A2
---
A domain MUST be a vertical slice of business capability, named for what it does for someone, with technology as a layer inside its Design stage. A domain whose title or domain code names a technology layer or delivery channel, as a whole word in any letter case (web app, frontend, backend, API, UI, server, database, desktop, mobile, engine, infrastructure, Electron and the like), SHOULD be reported as a `domain-named-for-technology` warning. Its body is not read, since a domain may well say which technologies serve it.
