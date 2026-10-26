---
id: LA-AUT-F06
kind: flow
title: Group a domain's endpoints into APIs and write its integrations
parent: LA-AUT-CAP03
links:
  carries_out: [LA-AUT-UC16]
---
1. An agent, or the owner, lists the resources the domain's endpoints serve, writes one `api` record for each under the domain, and changes each endpoint's `parent` to its API, keeping its ID.
2. They move each rule every endpoint of an API shares into one interaction requirement under the API, and the shared request and response shapes into the API's Shapes table.
3. For each outside system the domain exchanges with, they write an `integration` with its `system` and one interaction requirement per exchange.
4. They run `lathe check`, which reports a record under a parent its kind does not allow.
