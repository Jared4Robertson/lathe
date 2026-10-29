-- The test plan: one test kind per thing tested, each under exactly what it proves. Every test has a run by: its level,
-- its state, and the file that runs it or why it is manual. A constraint, invariant, specification, policy or flow has
-- exactly one test; a domain service, UC requirement, view requirement or API requirement at least one (a check, not a
-- refusal); an integration or a standard rule any number; a pattern rule one per domain that adopts it. A run by also
-- gives the test's size and its markers. Then the test data sets, under a domain, that tests start from.

-- A test's level says only how it runs, cheapest first: unit (in process, no storage or I/O), integration (in process,
-- with real storage: a database, files, git), service (through the product's interface in process, with real storage:
-- an HTTP handler, a CLI command function, an MCP handler), system (the running product driven from outside through its
-- real interface: HTTP to a running server, the real CLI or MCP process) and browser (a real browser or the desktop shell
-- against the running app). The test kind says what it tests and the state who runs it: a manual test names the level a
-- person exercises, such as browser for a person clicking through the app. A test runs at the lowest level that can
-- observe its result.
CREATE TYPE test_level AS ENUM ('unit', 'integration', 'service', 'system', 'browser');
CREATE TYPE test_state AS ENUM ('automated', 'manual', 'not automated yet');
-- A test's size besides small, the size of a test that gives none.
CREATE TYPE test_size AS ENUM ('volume', 'worst case');

CREATE TABLE constraint_test (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  constraint_id VARCHAR NOT NULL UNIQUE REFERENCES "constraint" (id),
  level test_level NOT NULL,
  state test_state NOT NULL,
  file VARCHAR,
  manual_reason VARCHAR,
  size test_size,
  smoke BOOLEAN CHECK (smoke),
  external BOOLEAN CHECK (external),
  accepts VARCHAR NOT NULL CHECK (trim(accepts) <> ''),
  refuses VARCHAR NOT NULL CHECK (trim(refuses) <> ''),
  notes VARCHAR,
  CHECK (state <> 'automated' OR file IS NOT NULL),
  CHECK ((state = 'manual') = (manual_reason IS NOT NULL))
);
COMMENT ON TABLE constraint_test IS 'Proves its constraint: the values its value object accepts and refuses.';
COMMENT ON COLUMN constraint_test.id IS 'The test''s ID: its constraint''s ID and T, such as TL-VO01-C01-T.';
COMMENT ON COLUMN constraint_test.title IS 'What the test shows, in a sentence.';
COMMENT ON COLUMN constraint_test.constraint_id IS 'The constraint it proves; it has exactly one test.';
COMMENT ON COLUMN constraint_test.level IS 'How it runs: unit, integration, service, system or browser, the lowest that can observe its result; a manual test names the level a person exercises.';
COMMENT ON COLUMN constraint_test.state IS 'automated: its file runs it; manual: a person follows it, for the reason given; not automated yet: meant to be automated, and not proof yet.';
COMMENT ON COLUMN constraint_test.file IS 'The file that runs it, from the product root; an automated test must name one.';
COMMENT ON COLUMN constraint_test.manual_reason IS 'Why a person runs it rather than a file; a manual test must give one, and only a manual test.';
COMMENT ON COLUMN constraint_test.size IS 'How much it exercises: none for small (a few records, the usual case), volume (many records, to show it holds at scale) or worst case (the slowest or largest input it must still handle).';
COMMENT ON COLUMN constraint_test.smoke IS 'Yes when it is a smoke test: one of the few run first, after a build or a deploy, to show the product works at all. Left out otherwise.';
COMMENT ON COLUMN constraint_test.external IS 'Yes when it reaches a system outside the product, such as a third-party service, so it needs that system and its access to run. Left out otherwise.';
COMMENT ON COLUMN constraint_test.accepts IS 'Values the value object accepts, such as a@b.org.';
COMMENT ON COLUMN constraint_test.refuses IS 'Values it refuses, and how.';
COMMENT ON COLUMN constraint_test.notes IS 'Longer notes on the test, such as when to run it.';

CREATE TABLE invariant_test (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  invariant_id VARCHAR NOT NULL UNIQUE REFERENCES invariant (id),
  level test_level NOT NULL,
  state test_state NOT NULL,
  file VARCHAR,
  manual_reason VARCHAR,
  size test_size,
  smoke BOOLEAN CHECK (smoke),
  external BOOLEAN CHECK (external),
  "when" VARCHAR NOT NULL CHECK (trim("when") <> ''),
  "then" VARCHAR NOT NULL CHECK (trim("then") <> ''),
  notes VARCHAR,
  CHECK (state <> 'automated' OR file IS NOT NULL),
  CHECK ((state = 'manual') = (manual_reason IS NOT NULL))
);
COMMENT ON TABLE invariant_test IS 'Proves its invariant: a change that would break it is refused, and the aggregate stays as it was.';
COMMENT ON COLUMN invariant_test.id IS 'The test''s ID: its invariant''s ID and T, such as TL-LEND-INV01-T.';
COMMENT ON COLUMN invariant_test.title IS 'What the test shows, in a sentence.';
COMMENT ON COLUMN invariant_test.invariant_id IS 'The invariant it proves; it has exactly one test.';
COMMENT ON COLUMN invariant_test.level IS 'How it runs: unit, integration, service, system or browser, the lowest that can observe its result; a manual test names the level a person exercises.';
COMMENT ON COLUMN invariant_test.state IS 'automated: its file runs it; manual: a person follows it, for the reason given; not automated yet: meant to be automated, and not proof yet.';
COMMENT ON COLUMN invariant_test.file IS 'The file that runs it, from the product root; an automated test must name one.';
COMMENT ON COLUMN invariant_test.manual_reason IS 'Why a person runs it rather than a file; a manual test must give one, and only a manual test.';
COMMENT ON COLUMN invariant_test.size IS 'How much it exercises: none for small (a few records, the usual case), volume (many records, to show it holds at scale) or worst case (the slowest or largest input it must still handle).';
COMMENT ON COLUMN invariant_test.smoke IS 'Yes when it is a smoke test: one of the few run first, after a build or a deploy, to show the product works at all. Left out otherwise.';
COMMENT ON COLUMN invariant_test.external IS 'Yes when it reaches a system outside the product, such as a third-party service, so it needs that system and its access to run. Left out otherwise.';
COMMENT ON COLUMN invariant_test."when" IS 'What the test does, in a sentence, opening with any state it sets up beyond the test data sets it starts from (starts_from).';
COMMENT ON COLUMN invariant_test."then" IS 'What the test expects.';
COMMENT ON COLUMN invariant_test.notes IS 'Longer notes on the test, such as when to run it.';

CREATE TABLE specification_test (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  specification_id VARCHAR NOT NULL UNIQUE REFERENCES specification (id),
  level test_level NOT NULL,
  state test_state NOT NULL,
  file VARCHAR,
  manual_reason VARCHAR,
  size test_size,
  smoke BOOLEAN CHECK (smoke),
  external BOOLEAN CHECK (external),
  "when" VARCHAR NOT NULL CHECK (trim("when") <> ''),
  "then" VARCHAR NOT NULL CHECK (trim("then") <> ''),
  notes VARCHAR,
  CHECK (state <> 'automated' OR file IS NOT NULL),
  CHECK ((state = 'manual') = (manual_reason IS NOT NULL))
);
COMMENT ON TABLE specification_test IS 'Proves its specification: which records satisfy the predicate and which do not.';
COMMENT ON COLUMN specification_test.id IS 'The test''s ID: its specification''s ID and T, such as TL-LEND-SP01-T.';
COMMENT ON COLUMN specification_test.title IS 'What the test shows, in a sentence.';
COMMENT ON COLUMN specification_test.specification_id IS 'The specification it proves; it has exactly one test.';
COMMENT ON COLUMN specification_test.level IS 'How it runs: unit, integration, service, system or browser, the lowest that can observe its result; a manual test names the level a person exercises.';
COMMENT ON COLUMN specification_test.state IS 'automated: its file runs it; manual: a person follows it, for the reason given; not automated yet: meant to be automated, and not proof yet.';
COMMENT ON COLUMN specification_test.file IS 'The file that runs it, from the product root; an automated test must name one.';
COMMENT ON COLUMN specification_test.manual_reason IS 'Why a person runs it rather than a file; a manual test must give one, and only a manual test.';
COMMENT ON COLUMN specification_test.size IS 'How much it exercises: none for small (a few records, the usual case), volume (many records, to show it holds at scale) or worst case (the slowest or largest input it must still handle).';
COMMENT ON COLUMN specification_test.smoke IS 'Yes when it is a smoke test: one of the few run first, after a build or a deploy, to show the product works at all. Left out otherwise.';
COMMENT ON COLUMN specification_test.external IS 'Yes when it reaches a system outside the product, such as a third-party service, so it needs that system and its access to run. Left out otherwise.';
COMMENT ON COLUMN specification_test."when" IS 'What the test does, in a sentence, opening with any state it sets up beyond the test data sets it starts from (starts_from).';
COMMENT ON COLUMN specification_test."then" IS 'What the test expects.';
COMMENT ON COLUMN specification_test.notes IS 'Longer notes on the test, such as when to run it.';

CREATE TABLE policy_test (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  policy_id VARCHAR NOT NULL UNIQUE REFERENCES policy (id),
  level test_level NOT NULL,
  state test_state NOT NULL,
  file VARCHAR,
  manual_reason VARCHAR,
  size test_size,
  smoke BOOLEAN CHECK (smoke),
  external BOOLEAN CHECK (external),
  "when" VARCHAR NOT NULL CHECK (trim("when") <> ''),
  "then" VARCHAR NOT NULL CHECK (trim("then") <> ''),
  notes VARCHAR,
  CHECK (state <> 'automated' OR file IS NOT NULL),
  CHECK ((state = 'manual') = (manual_reason IS NOT NULL))
);
COMMENT ON TABLE policy_test IS 'Proves its policy: when its event happens, its command is sent.';
COMMENT ON COLUMN policy_test.id IS 'The test''s ID: its policy''s ID and T, such as TL-LEND-PO01-T.';
COMMENT ON COLUMN policy_test.title IS 'What the test shows, in a sentence.';
COMMENT ON COLUMN policy_test.policy_id IS 'The policy it proves; it has exactly one test.';
COMMENT ON COLUMN policy_test.level IS 'How it runs: unit, integration, service, system or browser, the lowest that can observe its result; a manual test names the level a person exercises.';
COMMENT ON COLUMN policy_test.state IS 'automated: its file runs it; manual: a person follows it, for the reason given; not automated yet: meant to be automated, and not proof yet.';
COMMENT ON COLUMN policy_test.file IS 'The file that runs it, from the product root; an automated test must name one.';
COMMENT ON COLUMN policy_test.manual_reason IS 'Why a person runs it rather than a file; a manual test must give one, and only a manual test.';
COMMENT ON COLUMN policy_test.size IS 'How much it exercises: none for small (a few records, the usual case), volume (many records, to show it holds at scale) or worst case (the slowest or largest input it must still handle).';
COMMENT ON COLUMN policy_test.smoke IS 'Yes when it is a smoke test: one of the few run first, after a build or a deploy, to show the product works at all. Left out otherwise.';
COMMENT ON COLUMN policy_test.external IS 'Yes when it reaches a system outside the product, such as a third-party service, so it needs that system and its access to run. Left out otherwise.';
COMMENT ON COLUMN policy_test."when" IS 'What the test does, in a sentence, opening with any state it sets up beyond the test data sets it starts from (starts_from).';
COMMENT ON COLUMN policy_test."then" IS 'What the test expects.';
COMMENT ON COLUMN policy_test.notes IS 'Longer notes on the test, such as when to run it.';

CREATE TABLE domain_service_test (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  domain_service_id VARCHAR NOT NULL REFERENCES domain_service (id),
  level test_level NOT NULL,
  state test_state NOT NULL,
  file VARCHAR,
  manual_reason VARCHAR,
  size test_size,
  smoke BOOLEAN CHECK (smoke),
  external BOOLEAN CHECK (external),
  "when" VARCHAR NOT NULL CHECK (trim("when") <> ''),
  "then" VARCHAR NOT NULL CHECK (trim("then") <> ''),
  notes VARCHAR,
  CHECK (state <> 'automated' OR file IS NOT NULL),
  CHECK ((state = 'manual') = (manual_reason IS NOT NULL))
);
COMMENT ON TABLE domain_service_test IS 'Proves its domain service: from the inputs given, the value or decision it returns.';
COMMENT ON COLUMN domain_service_test.id IS 'The test''s ID: its domain service''s ID and T<nn>, such as TL-LEND-DS01-T01.';
COMMENT ON COLUMN domain_service_test.title IS 'What the test shows, in a sentence.';
COMMENT ON COLUMN domain_service_test.domain_service_id IS 'The domain service it proves.';
COMMENT ON COLUMN domain_service_test.level IS 'How it runs: unit, integration, service, system or browser, the lowest that can observe its result; a manual test names the level a person exercises.';
COMMENT ON COLUMN domain_service_test.state IS 'automated: its file runs it; manual: a person follows it, for the reason given; not automated yet: meant to be automated, and not proof yet.';
COMMENT ON COLUMN domain_service_test.file IS 'The file that runs it, from the product root; an automated test must name one.';
COMMENT ON COLUMN domain_service_test.manual_reason IS 'Why a person runs it rather than a file; a manual test must give one, and only a manual test.';
COMMENT ON COLUMN domain_service_test.size IS 'How much it exercises: none for small (a few records, the usual case), volume (many records, to show it holds at scale) or worst case (the slowest or largest input it must still handle).';
COMMENT ON COLUMN domain_service_test.smoke IS 'Yes when it is a smoke test: one of the few run first, after a build or a deploy, to show the product works at all. Left out otherwise.';
COMMENT ON COLUMN domain_service_test.external IS 'Yes when it reaches a system outside the product, such as a third-party service, so it needs that system and its access to run. Left out otherwise.';
COMMENT ON COLUMN domain_service_test."when" IS 'What the test does, in a sentence, opening with any state it sets up beyond the test data sets it starts from (starts_from).';
COMMENT ON COLUMN domain_service_test."then" IS 'What the test expects.';
COMMENT ON COLUMN domain_service_test.notes IS 'Longer notes on the test, such as when to run it.';

CREATE TABLE use_case_test (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  uc_requirement_id VARCHAR NOT NULL REFERENCES uc_requirement (id),
  level test_level NOT NULL,
  state test_state NOT NULL,
  file VARCHAR,
  manual_reason VARCHAR,
  size test_size,
  smoke BOOLEAN CHECK (smoke),
  external BOOLEAN CHECK (external),
  "when" VARCHAR NOT NULL CHECK (trim("when") <> ''),
  "then" VARCHAR NOT NULL CHECK (trim("then") <> ''),
  notes VARCHAR,
  CHECK (state <> 'automated' OR file IS NOT NULL),
  CHECK ((state = 'manual') = (manual_reason IS NOT NULL))
);
COMMENT ON TABLE use_case_test IS 'Proves its UC requirement, at the level the use case is stated: what the actor does and what the product does in answer.';
COMMENT ON COLUMN use_case_test.id IS 'The test''s ID: its UC requirement''s ID and T<nn>, such as TL-LEND-UC01-R01-T01.';
COMMENT ON COLUMN use_case_test.title IS 'What the test shows, in a sentence.';
COMMENT ON COLUMN use_case_test.uc_requirement_id IS 'The UC requirement it proves.';
COMMENT ON COLUMN use_case_test.level IS 'How it runs: unit, integration, service, system or browser, the lowest that can observe its result; a manual test names the level a person exercises.';
COMMENT ON COLUMN use_case_test.state IS 'automated: its file runs it; manual: a person follows it, for the reason given; not automated yet: meant to be automated, and not proof yet.';
COMMENT ON COLUMN use_case_test.file IS 'The file that runs it, from the product root; an automated test must name one.';
COMMENT ON COLUMN use_case_test.manual_reason IS 'Why a person runs it rather than a file; a manual test must give one, and only a manual test.';
COMMENT ON COLUMN use_case_test.size IS 'How much it exercises: none for small (a few records, the usual case), volume (many records, to show it holds at scale) or worst case (the slowest or largest input it must still handle).';
COMMENT ON COLUMN use_case_test.smoke IS 'Yes when it is a smoke test: one of the few run first, after a build or a deploy, to show the product works at all. Left out otherwise.';
COMMENT ON COLUMN use_case_test.external IS 'Yes when it reaches a system outside the product, such as a third-party service, so it needs that system and its access to run. Left out otherwise.';
COMMENT ON COLUMN use_case_test."when" IS 'What the test does, in a sentence, opening with any state it sets up beyond the test data sets it starts from (starts_from).';
COMMENT ON COLUMN use_case_test."then" IS 'What the test expects.';
COMMENT ON COLUMN use_case_test.notes IS 'Longer notes on the test, such as when to run it.';

CREATE TABLE view_test (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  view_requirement_id VARCHAR NOT NULL REFERENCES view_requirement (id),
  level test_level NOT NULL,
  state test_state NOT NULL,
  file VARCHAR,
  manual_reason VARCHAR,
  size test_size,
  smoke BOOLEAN CHECK (smoke),
  external BOOLEAN CHECK (external),
  "when" VARCHAR NOT NULL CHECK (trim("when") <> ''),
  "then" VARCHAR NOT NULL CHECK (trim("then") <> ''),
  notes VARCHAR,
  CHECK (state <> 'automated' OR file IS NOT NULL),
  CHECK ((state = 'manual') = (manual_reason IS NOT NULL))
);
COMMENT ON TABLE view_test IS 'Proves its view requirement in the view.';
COMMENT ON COLUMN view_test.id IS 'The test''s ID: its view requirement''s ID and T<nn>, such as TL-V01-R01-T01.';
COMMENT ON COLUMN view_test.title IS 'What the test shows, in a sentence.';
COMMENT ON COLUMN view_test.view_requirement_id IS 'The view requirement it proves.';
COMMENT ON COLUMN view_test.level IS 'How it runs: unit, integration, service, system or browser, the lowest that can observe its result; a manual test names the level a person exercises.';
COMMENT ON COLUMN view_test.state IS 'automated: its file runs it; manual: a person follows it, for the reason given; not automated yet: meant to be automated, and not proof yet.';
COMMENT ON COLUMN view_test.file IS 'The file that runs it, from the product root; an automated test must name one.';
COMMENT ON COLUMN view_test.manual_reason IS 'Why a person runs it rather than a file; a manual test must give one, and only a manual test.';
COMMENT ON COLUMN view_test.size IS 'How much it exercises: none for small (a few records, the usual case), volume (many records, to show it holds at scale) or worst case (the slowest or largest input it must still handle).';
COMMENT ON COLUMN view_test.smoke IS 'Yes when it is a smoke test: one of the few run first, after a build or a deploy, to show the product works at all. Left out otherwise.';
COMMENT ON COLUMN view_test.external IS 'Yes when it reaches a system outside the product, such as a third-party service, so it needs that system and its access to run. Left out otherwise.';
COMMENT ON COLUMN view_test."when" IS 'What the test does, in a sentence, opening with any state it sets up beyond the test data sets it starts from (starts_from).';
COMMENT ON COLUMN view_test."then" IS 'What the test expects.';
COMMENT ON COLUMN view_test.notes IS 'Longer notes on the test, such as when to run it.';

CREATE TABLE endpoint_test (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  api_requirement_id VARCHAR NOT NULL REFERENCES api_requirement (id),
  level test_level NOT NULL,
  state test_state NOT NULL,
  file VARCHAR,
  manual_reason VARCHAR,
  size test_size,
  smoke BOOLEAN CHECK (smoke),
  external BOOLEAN CHECK (external),
  "when" VARCHAR NOT NULL CHECK (trim("when") <> ''),
  "then" VARCHAR NOT NULL CHECK (trim("then") <> ''),
  notes VARCHAR,
  CHECK (state <> 'automated' OR file IS NOT NULL),
  CHECK ((state = 'manual') = (manual_reason IS NOT NULL))
);
COMMENT ON TABLE endpoint_test IS 'Proves its API requirement at the endpoint: the request and the response.';
COMMENT ON COLUMN endpoint_test.id IS 'The test''s ID: its API requirement''s ID and T<nn>, such as TL-LEND-EP01-R01-T01.';
COMMENT ON COLUMN endpoint_test.title IS 'What the test shows, in a sentence.';
COMMENT ON COLUMN endpoint_test.api_requirement_id IS 'The API requirement it proves.';
COMMENT ON COLUMN endpoint_test.level IS 'How it runs: unit, integration, service, system or browser, the lowest that can observe its result; a manual test names the level a person exercises.';
COMMENT ON COLUMN endpoint_test.state IS 'automated: its file runs it; manual: a person follows it, for the reason given; not automated yet: meant to be automated, and not proof yet.';
COMMENT ON COLUMN endpoint_test.file IS 'The file that runs it, from the product root; an automated test must name one.';
COMMENT ON COLUMN endpoint_test.manual_reason IS 'Why a person runs it rather than a file; a manual test must give one, and only a manual test.';
COMMENT ON COLUMN endpoint_test.size IS 'How much it exercises: none for small (a few records, the usual case), volume (many records, to show it holds at scale) or worst case (the slowest or largest input it must still handle).';
COMMENT ON COLUMN endpoint_test.smoke IS 'Yes when it is a smoke test: one of the few run first, after a build or a deploy, to show the product works at all. Left out otherwise.';
COMMENT ON COLUMN endpoint_test.external IS 'Yes when it reaches a system outside the product, such as a third-party service, so it needs that system and its access to run. Left out otherwise.';
COMMENT ON COLUMN endpoint_test."when" IS 'What the test does, in a sentence, opening with any state it sets up beyond the test data sets it starts from (starts_from).';
COMMENT ON COLUMN endpoint_test."then" IS 'What the test expects.';
COMMENT ON COLUMN endpoint_test.notes IS 'Longer notes on the test, such as when to run it.';

CREATE TABLE flow_test (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  flow_id VARCHAR NOT NULL UNIQUE REFERENCES flow (id),
  level test_level NOT NULL,
  state test_state NOT NULL,
  file VARCHAR,
  manual_reason VARCHAR,
  size test_size,
  smoke BOOLEAN CHECK (smoke),
  external BOOLEAN CHECK (external),
  steps VARCHAR[] NOT NULL CHECK (len(steps) >= 1),
  expected_result VARCHAR NOT NULL CHECK (trim(expected_result) <> ''),
  notes VARCHAR,
  CHECK (state <> 'automated' OR file IS NOT NULL),
  CHECK ((state = 'manual') = (manual_reason IS NOT NULL))
);
COMMENT ON TABLE flow_test IS 'A smoke test of its flow''s main path, end to end, at the level that fits its interface: browser for a web app or desktop, system for an API, a CLI or agent tools.';
COMMENT ON COLUMN flow_test.id IS 'The test''s ID: its flow''s ID and T, such as TL-LEND-UC01-FL01-T.';
COMMENT ON COLUMN flow_test.title IS 'What the test shows, in a sentence.';
COMMENT ON COLUMN flow_test.flow_id IS 'The flow it proves; it has exactly one test.';
COMMENT ON COLUMN flow_test.level IS 'How it runs: unit, integration, service, system or browser, the lowest that can observe its result; a manual test names the level a person exercises.';
COMMENT ON COLUMN flow_test.state IS 'automated: its file runs it; manual: a person follows it, for the reason given; not automated yet: meant to be automated, and not proof yet.';
COMMENT ON COLUMN flow_test.file IS 'The file that runs it, from the product root; an automated test must name one.';
COMMENT ON COLUMN flow_test.manual_reason IS 'Why a person runs it rather than a file; a manual test must give one, and only a manual test.';
COMMENT ON COLUMN flow_test.size IS 'How much it exercises: none for small (a few records, the usual case), volume (many records, to show it holds at scale) or worst case (the slowest or largest input it must still handle).';
COMMENT ON COLUMN flow_test.smoke IS 'Yes when it is a smoke test: one of the few run first, after a build or a deploy, to show the product works at all. Left out otherwise.';
COMMENT ON COLUMN flow_test.external IS 'Yes when it reaches a system outside the product, such as a third-party service, so it needs that system and its access to run. Left out otherwise.';
COMMENT ON COLUMN flow_test.steps IS 'What the test does along the main path, step by step.';
COMMENT ON COLUMN flow_test.expected_result IS 'What it expects at the end.';
COMMENT ON COLUMN flow_test.notes IS 'Longer notes on the test, such as when to run it.';

CREATE TABLE integration_test (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  integration_id VARCHAR NOT NULL REFERENCES integration (id),
  level test_level NOT NULL,
  state test_state NOT NULL,
  file VARCHAR,
  manual_reason VARCHAR,
  size test_size,
  smoke BOOLEAN CHECK (smoke),
  external BOOLEAN CHECK (external),
  "when" VARCHAR NOT NULL CHECK (trim("when") <> ''),
  "then" VARCHAR NOT NULL CHECK (trim("then") <> ''),
  notes VARCHAR,
  CHECK (state <> 'automated' OR file IS NOT NULL),
  CHECK ((state = 'manual') = (manual_reason IS NOT NULL))
);
COMMENT ON TABLE integration_test IS 'Proves an exchange with its integration''s outside system.';
COMMENT ON COLUMN integration_test.id IS 'The test''s ID: its integration''s ID and T<nn>, such as TL-INT01-T01.';
COMMENT ON COLUMN integration_test.title IS 'What the test shows, in a sentence.';
COMMENT ON COLUMN integration_test.integration_id IS 'The integration it proves.';
COMMENT ON COLUMN integration_test.level IS 'How it runs: unit, integration, service, system or browser, the lowest that can observe its result; a manual test names the level a person exercises.';
COMMENT ON COLUMN integration_test.state IS 'automated: its file runs it; manual: a person follows it, for the reason given; not automated yet: meant to be automated, and not proof yet.';
COMMENT ON COLUMN integration_test.file IS 'The file that runs it, from the product root; an automated test must name one.';
COMMENT ON COLUMN integration_test.manual_reason IS 'Why a person runs it rather than a file; a manual test must give one, and only a manual test.';
COMMENT ON COLUMN integration_test.size IS 'How much it exercises: none for small (a few records, the usual case), volume (many records, to show it holds at scale) or worst case (the slowest or largest input it must still handle).';
COMMENT ON COLUMN integration_test.smoke IS 'Yes when it is a smoke test: one of the few run first, after a build or a deploy, to show the product works at all. Left out otherwise.';
COMMENT ON COLUMN integration_test.external IS 'Yes when it reaches a system outside the product, such as a third-party service, so it needs that system and its access to run. Left out otherwise.';
COMMENT ON COLUMN integration_test."when" IS 'What the test does, in a sentence, opening with any state it sets up beyond the test data sets it starts from (starts_from).';
COMMENT ON COLUMN integration_test."then" IS 'What the test expects.';
COMMENT ON COLUMN integration_test.notes IS 'Longer notes on the test, such as when to run it.';

CREATE TABLE pattern_rule_test (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  pattern_rule_id VARCHAR NOT NULL REFERENCES pattern_rule (id),
  domain_id VARCHAR NOT NULL REFERENCES domain (id),
  level test_level NOT NULL,
  state test_state NOT NULL,
  file VARCHAR,
  manual_reason VARCHAR,
  size test_size,
  smoke BOOLEAN CHECK (smoke),
  external BOOLEAN CHECK (external),
  "when" VARCHAR NOT NULL CHECK (trim("when") <> ''),
  "then" VARCHAR NOT NULL CHECK (trim("then") <> ''),
  notes VARCHAR,
  UNIQUE (pattern_rule_id, domain_id),
  CHECK (state <> 'automated' OR file IS NOT NULL),
  CHECK ((state = 'manual') = (manual_reason IS NOT NULL))
);
COMMENT ON TABLE pattern_rule_test IS 'Proves its pattern rule in one domain that adopts the pattern: one test per pattern rule and adopting domain.';
COMMENT ON COLUMN pattern_rule_test.id IS 'The test''s ID: its pattern rule''s ID and T<nn>, such as TL-PAT-ACT-R01-T01.';
COMMENT ON COLUMN pattern_rule_test.title IS 'What the test shows, in a sentence.';
COMMENT ON COLUMN pattern_rule_test.pattern_rule_id IS 'The pattern rule it proves.';
COMMENT ON COLUMN pattern_rule_test.domain_id IS 'The domain it proves the rule in, one that follows the pattern itself or through a use case; one test per pattern rule and domain.';
COMMENT ON COLUMN pattern_rule_test.level IS 'How it runs: unit, integration, service, system or browser, the lowest that can observe its result; a manual test names the level a person exercises.';
COMMENT ON COLUMN pattern_rule_test.state IS 'automated: its file runs it; manual: a person follows it, for the reason given; not automated yet: meant to be automated, and not proof yet.';
COMMENT ON COLUMN pattern_rule_test.file IS 'The file that runs it, from the product root; an automated test must name one.';
COMMENT ON COLUMN pattern_rule_test.manual_reason IS 'Why a person runs it rather than a file; a manual test must give one, and only a manual test.';
COMMENT ON COLUMN pattern_rule_test.size IS 'How much it exercises: none for small (a few records, the usual case), volume (many records, to show it holds at scale) or worst case (the slowest or largest input it must still handle).';
COMMENT ON COLUMN pattern_rule_test.smoke IS 'Yes when it is a smoke test: one of the few run first, after a build or a deploy, to show the product works at all. Left out otherwise.';
COMMENT ON COLUMN pattern_rule_test.external IS 'Yes when it reaches a system outside the product, such as a third-party service, so it needs that system and its access to run. Left out otherwise.';
COMMENT ON COLUMN pattern_rule_test."when" IS 'What the test does, in a sentence, opening with any state it sets up beyond the test data sets it starts from (starts_from).';
COMMENT ON COLUMN pattern_rule_test."then" IS 'What the test expects.';
COMMENT ON COLUMN pattern_rule_test.notes IS 'Longer notes on the test, such as when to run it.';

CREATE TABLE standard_rule_test (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  standard_rule_id VARCHAR NOT NULL REFERENCES standard_rule (id),
  level test_level NOT NULL,
  state test_state NOT NULL,
  file VARCHAR,
  manual_reason VARCHAR,
  size test_size,
  smoke BOOLEAN CHECK (smoke),
  external BOOLEAN CHECK (external),
  "when" VARCHAR NOT NULL CHECK (trim("when") <> ''),
  "then" VARCHAR NOT NULL CHECK (trim("then") <> ''),
  notes VARCHAR,
  CHECK (state <> 'automated' OR file IS NOT NULL),
  CHECK ((state = 'manual') = (manual_reason IS NOT NULL))
);
COMMENT ON TABLE standard_rule_test IS 'Proves its standard rule in the product''s code, such as a scan of the code for what the rule forbids or a test of a place that follows it.';
COMMENT ON COLUMN standard_rule_test.id IS 'The test''s ID: its standard rule''s ID and T<nn>, such as TL-STD-CODE-R01-T01.';
COMMENT ON COLUMN standard_rule_test.title IS 'What the test shows, in a sentence.';
COMMENT ON COLUMN standard_rule_test.standard_rule_id IS 'The standard rule it proves.';
COMMENT ON COLUMN standard_rule_test.level IS 'How it runs: unit, integration, service, system or browser, the lowest that can observe its result; a manual test names the level a person exercises.';
COMMENT ON COLUMN standard_rule_test.state IS 'automated: its file runs it; manual: a person follows it, for the reason given; not automated yet: meant to be automated, and not proof yet.';
COMMENT ON COLUMN standard_rule_test.file IS 'The file that runs it, from the product root; an automated test must name one.';
COMMENT ON COLUMN standard_rule_test.manual_reason IS 'Why a person runs it rather than a file; a manual test must give one, and only a manual test.';
COMMENT ON COLUMN standard_rule_test.size IS 'How much it exercises: none for small (a few records, the usual case), volume (many records, to show it holds at scale) or worst case (the slowest or largest input it must still handle).';
COMMENT ON COLUMN standard_rule_test.smoke IS 'Yes when it is a smoke test: one of the few run first, after a build or a deploy, to show the product works at all. Left out otherwise.';
COMMENT ON COLUMN standard_rule_test.external IS 'Yes when it reaches a system outside the product, such as a third-party service, so it needs that system and its access to run. Left out otherwise.';
COMMENT ON COLUMN standard_rule_test."when" IS 'What the test does, in a sentence, opening with any state it sets up beyond the test data sets it starts from (starts_from).';
COMMENT ON COLUMN standard_rule_test."then" IS 'What the test expects.';
COMMENT ON COLUMN standard_rule_test.notes IS 'Longer notes on the test, such as when to run it.';

INSERT INTO meta_kind VALUES
  ('constraint_test', 'Constraint test', 'test-plan', 49, false, '<constraint>-T', 'TL-VO01-C01-T', 'parent', NULL),
  ('invariant_test', 'Invariant test', 'test-plan', 50, false, '<invariant>-T', 'TL-LEND-INV01-T', 'parent', NULL),
  ('specification_test', 'Specification test', 'test-plan', 51, false, '<specification>-T', 'TL-LEND-SP01-T', 'parent', NULL),
  ('policy_test', 'Policy test', 'test-plan', 52, false, '<policy>-T', 'TL-LEND-PO01-T', 'parent', NULL),
  ('domain_service_test', 'Domain service test', 'test-plan', 53, false, '<domain service>-T<nn>', 'TL-LEND-DS01-T01', 'parent', NULL),
  ('use_case_test', 'Use case test', 'test-plan', 54, false, '<UC requirement>-T<nn>', 'TL-LEND-UC01-R01-T01', 'parent', NULL),
  ('view_test', 'View test', 'test-plan', 55, false, '<view requirement>-T<nn>', 'TL-V01-R01-T01', 'parent', NULL),
  ('endpoint_test', 'Endpoint test', 'test-plan', 56, false, '<API requirement>-T<nn>', 'TL-LEND-EP01-R01-T01', 'parent', NULL),
  ('flow_test', 'Flow test', 'test-plan', 57, false, '<flow>-T', 'TL-LEND-UC01-FL01-T', 'parent', NULL),
  ('integration_test', 'Integration test', 'test-plan', 58, false, '<integration>-T<nn>', 'TL-INT01-T01', 'parent', NULL),
  ('pattern_rule_test', 'Pattern rule test', 'test-plan', 59, false, '<pattern rule>-T<nn>', 'TL-PAT-ACT-R01-T01', 'parent', NULL),
  ('standard_rule_test', 'Standard rule test', 'test-plan', 60, false, '<standard rule>-T<nn>', 'TL-STD-CODE-R01-T01', 'parent', NULL);
INSERT INTO meta_kind_parent VALUES
  ('constraint_test', 'constraint', 1, 'constraint_id'),
  ('invariant_test', 'invariant', 1, 'invariant_id'),
  ('specification_test', 'specification', 1, 'specification_id'),
  ('policy_test', 'policy', 1, 'policy_id'),
  ('domain_service_test', 'domain_service', 1, 'domain_service_id'),
  ('use_case_test', 'uc_requirement', 1, 'uc_requirement_id'),
  ('view_test', 'view_requirement', 1, 'view_requirement_id'),
  ('endpoint_test', 'api_requirement', 1, 'api_requirement_id'),
  ('flow_test', 'flow', 1, 'flow_id'),
  ('integration_test', 'integration', 1, 'integration_id'),
  ('pattern_rule_test', 'pattern_rule', 1, 'pattern_rule_id'),
  ('standard_rule_test', 'standard_rule', 1, 'standard_rule_id');
INSERT INTO meta_table VALUES
  ('constraint_test', 'kind', NULL),
  ('invariant_test', 'kind', NULL),
  ('specification_test', 'kind', NULL),
  ('policy_test', 'kind', NULL),
  ('domain_service_test', 'kind', NULL),
  ('use_case_test', 'kind', NULL),
  ('view_test', 'kind', NULL),
  ('endpoint_test', 'kind', NULL),
  ('flow_test', 'kind', NULL),
  ('integration_test', 'kind', NULL),
  ('pattern_rule_test', 'kind', NULL),
  ('standard_rule_test', 'kind', NULL);

CREATE TABLE test_data_set (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  domain_id VARCHAR NOT NULL REFERENCES domain (id),
  environment VARCHAR NOT NULL CHECK (trim(environment) <> ''),
  accounts VARCHAR,
  records VARCHAR NOT NULL CHECK (trim(records) <> ''),
  prepare VARCHAR NOT NULL CHECK (trim(prepare) <> ''),
  reset VARCHAR NOT NULL CHECK (trim(reset) <> ''),
  file VARCHAR,
  description VARCHAR NOT NULL CHECK (trim(description) <> '')
);
COMMENT ON TABLE test_data_set IS 'What some tests start from: the environment, the accounts and the starting records, how to prepare and reset them, and the file that builds them. Tests link to it with starts_from.';
COMMENT ON COLUMN test_data_set.id IS 'The data set''s ID: its domain''s ID and TD<nn>, such as TL-LEND-TD01.';
COMMENT ON COLUMN test_data_set.title IS 'The data set in a few words, such as Two members, one tool on loan.';
COMMENT ON COLUMN test_data_set.domain_id IS 'The domain whose tests it serves.';
COMMENT ON COLUMN test_data_set.environment IS 'Where it runs: the database, server or browser storage it is built in.';
COMMENT ON COLUMN test_data_set.accounts IS 'The accounts and roles it signs in as.';
COMMENT ON COLUMN test_data_set.records IS 'The records it starts with.';
COMMENT ON COLUMN test_data_set.prepare IS 'How to prepare it before a test.';
COMMENT ON COLUMN test_data_set.reset IS 'How to reset it after a test, so the next starts clean.';
COMMENT ON COLUMN test_data_set.file IS 'The seed or fixture that builds it, from the product root.';
COMMENT ON COLUMN test_data_set.description IS 'What it is for, in a sentence or two.';

INSERT INTO meta_kind VALUES ('test_data_set', 'Test data set', 'test-plan', 48, false, '<P>-<D>-TD<nn>', 'TL-LEND-TD01', 'domain', NULL);
INSERT INTO meta_kind_parent VALUES ('test_data_set', 'domain', 1, 'domain_id');
INSERT INTO meta_table VALUES ('test_data_set', 'kind', NULL);
