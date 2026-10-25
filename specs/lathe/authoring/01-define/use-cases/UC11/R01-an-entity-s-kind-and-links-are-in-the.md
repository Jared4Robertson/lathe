---
id: LA-AUT-UC11-R01
kind: requirement
title: An entity's kind and links are in the meta-model
parent: LA-AUT-UC11
---
The meta-model MUST have an `entity` kind in the domain model folder, under an aggregate and requiring `role`, the relations `has_one`, `has_many` and `refers_to` from entity to entity, and `involves` from domain rule to aggregate, labeled Involves and Involved in. The record format MUST describe them, when a domain rule sits under its domain, the Fields table, the checks and the ERDs the app draws.
