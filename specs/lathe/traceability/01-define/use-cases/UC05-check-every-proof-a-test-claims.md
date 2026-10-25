---
id: LA-TRC-UC05
kind: use_case
title: Check every proof a test claims
parent: LA-TRC-CAP02
actor: Owner, Agent
links:
  applies: [LA-TRC-DR11, LA-TRC-DR12, LA-TRC-DR13, LA-TRC-DR14, LA-TRC-DR04, LA-TRC-DR15]
---
A test record says which records it proves. A person, or an AI agent, writes the test and its code, and `lathe check` confirms that the code backs every claim:

1. If the test's file names the test's own ID, the test record vouches for all its claims.
2. Otherwise the file must name every ID the test proves. For a test that proves two rules but whose code names only one, the check reports the one left out.
3. A test whose code names no ID at all, such as a pattern proof kept in its own file, gives a `key`: text the file must contain, such as a test function name.

The person fixes each error by naming the missing ID in the test's name, by naming the test's own ID, or by removing a claim the test does not really prove.

A claim the code does not back proves nothing: its obligation stays unproved, in the `unproved` warnings and in coverage alike.
