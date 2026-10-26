---
id: LA-AUT-UC16-R01
kind: requirement
title: Standards and meets are in the meta-model
parent: LA-AUT-UC16
---
The meta-model MUST have a `standard` kind under the product and a `standard_rule` kind under a standard, both in the Shared folder right after the patterns, with IDs `<P>-STD-<name>` and `<standard>-R<nn>`, and the relation `meets` from a component or a test to a standard rule, labeled Meets and Met by, with no role. The record format MUST describe them, with the rule of thumb that a rule you prove with tests is a pattern rule and a rule you follow and cite is a standard rule.
