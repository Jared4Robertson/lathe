# Plan: after the domain model

## Outcome
The additions the Owner chose once the domain model cutover landed, so the trace runs from why to proof.

## Status
Agreed (2026-10-27), not started.

## Decisions (Owner)
1. **A discovery stage, first in the order:** a **business outcome** kind under the product, with a measurable statement, its measure and its target. Capabilities link to the outcomes they serve, many to many. Coverage reports an outcome no capability serves, and a capability that serves no outcome, as gaps. That completes the trace from why to proof: outcome, capability, use case, code, test.
2. **Test data sets** (test plan stage), under a domain: the environment, accounts and starting records some tests need, how to prepare and reset them, and the file that builds them (a seed or fixture). Tests link to the data sets they start from. A data set no test uses is reported, and so is a data set whose file doesn't exist.
3. **Test size and markers on the run by:** a size (small, volume or worst case; small when not given) and two markers, smoke and external.

Later, when a product needs them: process managers (workflows), the context map and system map, engineering checks, and service levels as standards.

