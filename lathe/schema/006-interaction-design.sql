-- Interaction design: the product's interfaces, each use case's flows (one per interface it happens through) and
-- their steps, views and view requirements, endpoints and API requirements, and integrations. Views and integrations
-- have no owner: flow steps use them.

CREATE TYPE http_method AS ENUM ('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS');
CREATE TYPE interface_kind AS ENUM ('web app', 'API', 'CLI', 'agent tools', 'desktop', 'other');

CREATE TABLE interface (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  product_id VARCHAR NOT NULL REFERENCES product (id),
  kind interface_kind NOT NULL,
  description VARCHAR NOT NULL CHECK (trim(description) <> '')
);
COMMENT ON TABLE interface IS 'A way people or programs use the product, such as its web app, its HTTP API or its command line. A use case happens through one or more interfaces, with one flow for each, and the kind says what that flow''s steps go through.';
COMMENT ON COLUMN interface.id IS 'The interface''s ID: its product''s ID and IF<nn>, such as TL-IF01. Its number ends the ID of every flow through it.';
COMMENT ON COLUMN interface.title IS 'The interface''s name, such as Web app, HTTP API, CLI, MCP tools or Desktop app.';
COMMENT ON COLUMN interface.product_id IS 'The product it belongs to.';
COMMENT ON COLUMN interface.kind IS 'What it is: web app or desktop (a flow''s steps happen in views), API (they call endpoints, through the command or query each exposes), CLI or agent tools (they run commands and queries), or other. A step of an API, CLI or agent tools flow happens in no view.';
COMMENT ON COLUMN interface.description IS 'Who uses it and how, in a sentence or two.';

CREATE TABLE flow (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  use_case_id VARCHAR NOT NULL REFERENCES use_case (id),
  interface_id VARCHAR NOT NULL REFERENCES interface (id),
  UNIQUE (use_case_id, interface_id)
);
COMMENT ON TABLE flow IS 'How its use case is carried out through one interface: the steps on its main path and its alternate paths. A use case has one flow per interface it happens through, and each flow belongs only to it.';
COMMENT ON COLUMN flow.id IS 'The flow''s ID: its use case''s ID, FL and its interface''s number, such as TL-LEND-UC01-FL01 for the flow through TL-IF01.';
COMMENT ON COLUMN flow.title IS 'The flow''s name, such as Borrow a tool at the desk.';
COMMENT ON COLUMN flow.use_case_id IS 'The use case it carries out.';
COMMENT ON COLUMN flow.interface_id IS 'The interface it goes through, of the same product; at most one flow per use case and interface.';

CREATE TABLE flow_step (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  flow_id VARCHAR NOT NULL REFERENCES flow (id),
  path VARCHAR NOT NULL CHECK (trim(path) <> ''),
  position INTEGER NOT NULL CHECK (position >= 1),
  UNIQUE (flow_id, path, position)
);
COMMENT ON TABLE flow_step IS 'One step of a flow, in order on its path. It fulfills UC requirements of its own use case, invokes at most one command or query, happens in at most one view (only on a web app, desktop or other interface) and may exchange with integrations.';
COMMENT ON COLUMN flow_step.id IS 'The step''s ID: its flow''s ID and S<nn>, such as TL-LEND-UC01-FL01-S01.';
COMMENT ON COLUMN flow_step.title IS 'What happens, in a few words.';
COMMENT ON COLUMN flow_step.flow_id IS 'The flow it belongs to.';
COMMENT ON COLUMN flow_step.path IS 'The path through the flow the step is on, such as main or refused.';
COMMENT ON COLUMN flow_step.position IS 'The step''s place on its path, from 1.';

CREATE TABLE view (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  route VARCHAR,
  description VARCHAR NOT NULL CHECK (trim(description) <> ''),
  notes VARCHAR
);
COMMENT ON TABLE view IS 'A screen or page a person uses. It has no owner: it exists because flow steps happen in it, and its product follows from its ID.';
COMMENT ON COLUMN view.id IS 'The view''s ID: the product prefix and V<nn>, such as TL-V01.';
COMMENT ON COLUMN view.title IS 'The view''s name, such as Catalog.';
COMMENT ON COLUMN view.route IS 'The address it is shown at, such as /catalog.';
COMMENT ON COLUMN view.description IS 'What the view shows and lets a person do, in a paragraph.';
COMMENT ON COLUMN view.notes IS 'Longer notes on the view.';

CREATE TABLE view_requirement (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  view_id VARCHAR NOT NULL REFERENCES view (id),
  statement VARCHAR NOT NULL CHECK (trim(statement) <> ''),
  group_name VARCHAR
);
COMMENT ON TABLE view_requirement IS 'One rule a view must follow, such as what it shows while loading or a field''s limits.';
COMMENT ON COLUMN view_requirement.id IS 'The requirement''s ID: its view''s ID and R<nn>, such as TL-V01-R01.';
COMMENT ON COLUMN view_requirement.title IS 'The requirement in a few words.';
COMMENT ON COLUMN view_requirement.view_id IS 'The view it belongs to.';
COMMENT ON COLUMN view_requirement.statement IS 'The requirement, stated with MUST, MUST NOT, SHOULD or MAY.';
COMMENT ON COLUMN view_requirement.group_name IS 'A short heading it is shown under among its siblings.';

CREATE TABLE endpoint (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  command_id VARCHAR REFERENCES command (id),
  query_id VARCHAR REFERENCES query (id),
  method http_method NOT NULL,
  route VARCHAR NOT NULL CHECK (trim(route) <> ''),
  description VARCHAR NOT NULL CHECK (trim(description) <> ''),
  notes VARCHAR,
  CHECK ((command_id IS NULL) <> (query_id IS NULL)),
  CHECK (title = method::VARCHAR || ' ' || route)
);
COMMENT ON TABLE endpoint IS 'An HTTP endpoint that exposes exactly one command or query, its parent. Flow steps reach it through their command or query, never directly.';
COMMENT ON COLUMN endpoint.id IS 'The endpoint''s ID, such as TL-LEND-EP01.';
COMMENT ON COLUMN endpoint.title IS 'Its method and route, one space apart, such as POST /loans: refused otherwise.';
COMMENT ON COLUMN endpoint.command_id IS 'The command it exposes; exactly one of command and query is given.';
COMMENT ON COLUMN endpoint.query_id IS 'The query it exposes; exactly one of command and query is given.';
COMMENT ON COLUMN endpoint.method IS 'The HTTP method.';
COMMENT ON COLUMN endpoint.route IS 'The route, such as /loans or /tools/{toolId}/damage.';
COMMENT ON COLUMN endpoint.description IS 'Its request and responses, in a sentence or two.';
COMMENT ON COLUMN endpoint.notes IS 'Longer notes on the endpoint.';

CREATE TABLE api_requirement (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  endpoint_id VARCHAR NOT NULL REFERENCES endpoint (id),
  statement VARCHAR NOT NULL CHECK (trim(statement) <> ''),
  group_name VARCHAR
);
COMMENT ON TABLE api_requirement IS 'One rule an endpoint must follow, such as an error''s response or a limit on its request.';
COMMENT ON COLUMN api_requirement.id IS 'The requirement''s ID: its endpoint''s ID and R<nn>, such as TL-LEND-EP01-R01.';
COMMENT ON COLUMN api_requirement.title IS 'The requirement in a few words.';
COMMENT ON COLUMN api_requirement.endpoint_id IS 'The endpoint it belongs to.';
COMMENT ON COLUMN api_requirement.statement IS 'The requirement, stated with MUST, MUST NOT, SHOULD or MAY.';
COMMENT ON COLUMN api_requirement.group_name IS 'A short heading it is shown under among its siblings.';

CREATE TABLE integration (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  system VARCHAR,
  description VARCHAR NOT NULL CHECK (trim(description) <> '')
);
COMMENT ON TABLE integration IS 'An outside system the product exchanges with, such as a payment provider or a mail service. It has no owner: it exists because flow steps exchange with it, and its product follows from its ID.';
COMMENT ON COLUMN integration.id IS 'The integration''s ID: the product prefix and INT<nn>, such as TL-INT01.';
COMMENT ON COLUMN integration.title IS 'The integration''s name.';
COMMENT ON COLUMN integration.system IS 'The outside system, such as Stripe.';
COMMENT ON COLUMN integration.description IS 'What the product exchanges with it, in a sentence or two.';

INSERT INTO meta_kind VALUES
  ('interface', 'Interface', 'interaction-design', 22, false, '<P>-IF<nn>', 'TL-IF01', 'parent', NULL),
  ('flow', 'Flow', 'interaction-design', 23, false, '<use case>-FL<nn>', 'TL-LEND-UC01-FL01', 'parent', NULL),
  ('flow_step', 'Flow step', 'interaction-design', 24, false, '<flow>-S<nn>', 'TL-LEND-UC01-FL01-S01', 'parent', NULL),
  ('view', 'View', 'interaction-design', 25, false, '<P>-V<nn>', 'TL-V01', 'product', NULL),
  ('view_requirement', 'View requirement', 'interaction-design', 26, true, '<view>-R<nn>', 'TL-V01-R01', 'parent', NULL),
  ('endpoint', 'Endpoint', 'interaction-design', 27, false, '<P>-<D>-EP<nn>', 'TL-LEND-EP01', 'domain', NULL),
  ('api_requirement', 'API requirement', 'interaction-design', 28, true, '<endpoint>-R<nn>', 'TL-LEND-EP01-R01', 'parent', NULL),
  ('integration', 'Integration', 'interaction-design', 29, false, '<P>-INT<nn>', 'TL-INT01', 'product', NULL);
INSERT INTO meta_kind_parent VALUES
  ('interface', 'product', 1, 'product_id'),
  ('flow', 'use_case', 1, 'use_case_id'),
  ('flow_step', 'flow', 1, 'flow_id'),
  ('view_requirement', 'view', 1, 'view_id'),
  ('endpoint', 'command', 1, 'command_id'), ('endpoint', 'query', 2, 'query_id'),
  ('api_requirement', 'endpoint', 1, 'endpoint_id');
INSERT INTO meta_table VALUES
  ('interface', 'kind', NULL), ('flow', 'kind', NULL), ('flow_step', 'kind', NULL), ('view', 'kind', NULL), ('view_requirement', 'kind', NULL),
  ('endpoint', 'kind', NULL), ('api_requirement', 'kind', NULL), ('integration', 'kind', NULL);
