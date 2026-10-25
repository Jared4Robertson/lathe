# Brief: S2 trial 4, how close Lathe now is to S2's organization

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main`. This brief is research: it writes findings, not product code.

## Goal
Jared's aim is for Lathe to organize a product as well as S2_sandbox does. Since trial 3, Lathe has gained:
- capabilities, folders (Define and Design), layers, entities and domain events;
- the structure-size checks, relation labels and the generated format reference;
- test-plan grouping by proof;
- the Model view (an ERD).

Measure again where Lathe matches S2's organization and where it still falls short, and recommend what's next.

## Confidentiality (strict)
- S2_sandbox (`~/Development/S2_sandbox`) is a confidential client repo. Read it only.
- Never open any `.env*` file.
- Copy no requirement text, business rules, or client or partner names into the Lathe repo.
- Any trial data (converted records, scripts, outputs) goes only in `/private/tmp/claude-501/-Users-jaredrobertson-Development-Lathe/0d7db615-27a3-4cec-b0fe-9823300bda27/scratchpad/s2-trial-4/`.

## What to do
1. Pick two or three S2 domains of different shapes. Convert a meaningful slice of each into Lathe records in the scratch folder:
   - the domain model: aggregates, entities and their fields, domain rules, and any events;
   - capabilities and use cases with requirements;
   - interaction design: flows, views and endpoints;
   - the technical specification's components, in layers;
   - the test plan's tests, with proofs.
   
   Then run `lathe check` and `lathe format` on it (point `--root` at the scratch folder).
2. Compare:
   - what S2 expresses that Lathe can't, or can only as prose;
   - what Lathe checks that S2 checks only by hand;
   - where Lathe's checks misfire on real material (false warnings);
   - how the structure checks (`too-many-children`, `lone-child`) judge real S2 domains;
   - how the folders, layers and the Model view map onto S2's folder tree.
3. Write `notes/trials/s2-trial-4.md` in the Lathe repo. It holds findings only, in general terms, with no S2 content and no names:
   - a scorecard by area (domain model, use cases, interaction design, technical specification, test plan, traceability, standards and patterns);
   - the top 10 gaps, ranked, each with a recommended change to Lathe (meta-model, checks or app) and its size;
   - the false warnings, with suggested fixes.

## Scope
- **You own:** `notes/trials/s2-trial-4.md`, and the scratch folder.
- No changes to Lathe's code or specs.

## Report
The top 10 gaps, with recommendations, and the scorecard. No S2 content.
