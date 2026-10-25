---
id: LA-TRC-UC14-R01
kind: requirement
title: An obligation lists what designs, proves, supports and carries it out
parent: LA-TRC-UC14
---
An obligation's record page MUST show a Traceability section after its body and before its children, with these groups in this order, each left out when empty: Designed by (its incoming `design`-role links, each component marked built or not built), Proved by (its incoming `proof`-role links, each test with its state), Supported by, Carried out in, Applied by, then its other incoming links under their reverse labels, then its links out under their forward labels, such as the aggregates a domain rule involves. An interaction requirement's links out to what it carries out MUST NOT be repeated there, since its own Carries out section shows them.
