---
id: LA-AUT-UC13-R01
kind: requirement
title: A domain event's kind and links are in the meta-model
parent: LA-AUT-UC13
---
The meta-model MUST have a `domain_event` kind in the domain model folder, under an aggregate, with no required fields and IDs `<P>-<D>-EV<nn>`, the relation `raised_by` from domain event to entity, and `reacts_to` from an aggregate, a use case or a component to a domain event. The record format MUST describe them.
