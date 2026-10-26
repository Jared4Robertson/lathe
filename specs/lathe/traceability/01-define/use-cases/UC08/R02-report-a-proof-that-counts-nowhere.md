---
id: LA-TRC-UC08-R02
kind: requirement
title: A test whose proof counts in no domain is reported
parent: LA-TRC-UC08
---
A test that proves at least one record, none of whose proofs counts in any domain's coverage, MUST get a `proof-counts-nowhere` warning. The message MUST name each target with its reason: it is not an obligation, it sits in no domain, it is a pattern rule owed only by other domains, or it is a pattern rule no domain owes (no use case follows its pattern, or wherever it is followed the rule's setting is Not applicable or no follower meets its `applies_when`).
