-- Interaction design: the product's interfaces (each with the roles who use it and the use cases it offers), each use
-- case's one flow and its steps, views and view requirements, endpoints and API requirements, and integrations. A flow
-- is the same whatever the interface: each interface's version of it is derived from its steps' commands and queries
-- by the interface's pattern, never stored. Views and integrations have no owner: views present commands and queries,
-- and flow steps exchange with integrations.

CREATE TYPE http_method AS ENUM ('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS');
CREATE TYPE interface_kind AS ENUM ('web app', 'API', 'CLI', 'agent tools', 'desktop', 'other');

CREATE TABLE interface (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  product_id VARCHAR NOT NULL REFERENCES product (id),
  kind interface_kind NOT NULL,
  description VARCHAR NOT NULL CHECK (trim(description) <> ''),
  public BOOLEAN NOT NULL
);
COMMENT ON TABLE interface IS 'A way people or programs use the product, such as its web app, its HTTP API or its command line. It offers use cases (offers), is used by some of the product''s roles (interface_actor rows) and follows the pattern that says how a step is carried out through it (follows): its version of each flow it offers is derived from that, never written.';
COMMENT ON COLUMN interface.id IS 'The interface''s ID: its product''s ID and IF<nn>, such as TL-IF01.';
COMMENT ON COLUMN interface.title IS 'The interface''s name, such as Web app, HTTP API, CLI, MCP tools or Desktop app.';
COMMENT ON COLUMN interface.product_id IS 'The product it belongs to.';
COMMENT ON COLUMN interface.kind IS 'What it is: web app or desktop (a step is carried out in the views that present its command or query), API (through the endpoint that exposes it), CLI or agent tools (by the product''s own command or tool for it), or other.';
COMMENT ON COLUMN interface.description IS 'Who uses it and how, in a sentence or two.';
COMMENT ON COLUMN interface.public IS 'Whether people or programs outside the product build on it, so its contract is the product''s own commitment: a public API''s requirements are essential complexity, an internal one''s (such as the API only the product''s own app calls) accidental.';

CREATE TABLE interface_actor (
  interface_id VARCHAR NOT NULL REFERENCES interface (id),
  position INTEGER NOT NULL CHECK (position >= 1),
  role_name VARCHAR NOT NULL,
  PRIMARY KEY (interface_id, position),
  UNIQUE (interface_id, role_name)
);
COMMENT ON TABLE interface_actor IS 'One role that uses an interface, in order: a role of the interface''s product. A step''s actor through the interface is the first of its use case''s actors the interface lists.';
COMMENT ON COLUMN interface_actor.interface_id IS 'The interface.';
COMMENT ON COLUMN interface_actor.position IS 'The role''s place among the interface''s roles, from 1.';
COMMENT ON COLUMN interface_actor.role_name IS 'The role, which the product names in its role rows.';

CREATE TABLE flow (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  use_case_id VARCHAR NOT NULL UNIQUE REFERENCES use_case (id)
);
COMMENT ON TABLE flow IS 'How its use case is carried out, whatever the interface: the steps on its main path and its alternate paths. A use case has one flow, and each interface that offers the use case has its own version of it, derived from the steps'' commands and queries by the interface''s pattern.';
COMMENT ON COLUMN flow.id IS 'The flow''s ID: its use case''s ID and FL, such as TL-LEND-UC01-FL.';
COMMENT ON COLUMN flow.title IS 'The flow''s name: its use case''s title, such as Borrow a tool.';
COMMENT ON COLUMN flow.use_case_id IS 'The use case it carries out, which has no other flow.';

CREATE TABLE flow_step (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  flow_id VARCHAR NOT NULL REFERENCES flow (id),
  path VARCHAR NOT NULL CHECK (trim(path) <> ''),
  position INTEGER NOT NULL CHECK (position >= 1),
  interface_id VARCHAR REFERENCES interface (id),
  UNIQUE (flow_id, path, position)
);
COMMENT ON TABLE flow_step IS 'One step of a flow, in order on its path, in the words of the people who take it. It fulfills UC requirements of its own use case, invokes at most one command or query and may exchange with integrations; where it happens is its interface''s, derived. A step only one interface can do is a variant: it names that interface.';
COMMENT ON COLUMN flow_step.id IS 'The step''s ID: its flow''s ID and S<nn>, such as TL-LEND-UC01-FL-S01.';
COMMENT ON COLUMN flow_step.title IS 'What happens, in a few words.';
COMMENT ON COLUMN flow_step.flow_id IS 'The flow it belongs to.';
COMMENT ON COLUMN flow_step.path IS 'The path through the flow the step is on, such as main or refused.';
COMMENT ON COLUMN flow_step.position IS 'The step''s place on its path, from 1, among every interface''s steps; each interface''s version skips the other interfaces'' variants.';
COMMENT ON COLUMN flow_step.interface_id IS 'The one interface that does this step, which makes it a variant, such as opening the app from the Dock; none when every interface that offers the use case does it. The interface offers the step''s use case.';

CREATE TABLE view (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  route VARCHAR,
  interface_id VARCHAR REFERENCES interface (id),
  description VARCHAR NOT NULL CHECK (trim(description) <> ''),
  notes VARCHAR
);
COMMENT ON TABLE view IS 'A screen or page a person uses. It has no owner: it exists because it presents commands and queries (presents), so a step that invokes one is carried out in it on a web app or desktop interface, and its product follows from its ID.';
COMMENT ON COLUMN view.id IS 'The view''s ID: the product prefix and V<nn>, such as TL-V01.';
COMMENT ON COLUMN view.title IS 'The view''s name, such as Catalog.';
COMMENT ON COLUMN view.route IS 'The address it is shown at, such as /catalog.';
COMMENT ON COLUMN view.interface_id IS 'The one interface that shows it, such as the desktop app''s Dock icon; none when every web app and desktop interface of its product shows it.';
COMMENT ON COLUMN view.description IS 'What the view shows and lets a person do, in a paragraph.';
COMMENT ON COLUMN view.notes IS 'Longer notes on the view.';

CREATE TABLE view_requirement (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  view_id VARCHAR NOT NULL REFERENCES view (id),
  statement VARCHAR NOT NULL CHECK (trim(statement) <> ''),
  group_name VARCHAR
);
COMMENT ON TABLE view_requirement IS 'One rule a view must follow, such as what it shows while loading or a field''s limits. The UI components whose code does what it says build it (builds).';
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
COMMENT ON TABLE endpoint IS 'An HTTP endpoint that exposes exactly one command or query, its parent. A step that invokes it is carried out through it on an API interface: steps reach it through their command or query, never directly.';
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
  ('interface', 'Interface', 'interaction-design', 24, false, '<P>-IF<nn>', 'TL-IF01', 'parent', NULL, 'essential'),
  ('flow', 'Flow', 'interaction-design', 25, false, '<use case>-FL', 'TL-LEND-UC01-FL', 'parent', NULL, 'essential'),
  ('flow_step', 'Flow step', 'interaction-design', 26, false, '<flow>-S<nn>', 'TL-LEND-UC01-FL-S01', 'parent', NULL, 'essential'),
  ('view', 'View', 'interaction-design', 27, false, '<P>-V<nn>', 'TL-V01', 'product', NULL, 'essential'),
  ('view_requirement', 'View requirement', 'interaction-design', 28, true, '<view>-R<nn>', 'TL-V01-R01', 'parent', NULL, 'essential'),
  ('endpoint', 'Endpoint', 'interaction-design', 29, false, '<P>-<D>-EP<nn>', 'TL-LEND-EP01', 'domain', NULL, 'accidental'),
  ('api_requirement', 'API requirement', 'interaction-design', 30, true, '<endpoint>-R<nn>', 'TL-LEND-EP01-R01', 'parent', NULL, 'by-interface'),
  ('integration', 'Integration', 'interaction-design', 31, false, '<P>-INT<nn>', 'TL-INT01', 'product', NULL, 'essential');
INSERT INTO meta_kind_parent VALUES
  ('interface', 'product', 1, 'product_id'),
  ('flow', 'use_case', 1, 'use_case_id'),
  ('flow_step', 'flow', 1, 'flow_id'),
  ('view_requirement', 'view', 1, 'view_id'),
  ('endpoint', 'command', 1, 'command_id'), ('endpoint', 'query', 2, 'query_id'),
  ('api_requirement', 'endpoint', 1, 'endpoint_id');
INSERT INTO meta_table VALUES
  ('interface', 'kind', NULL), ('interface_actor', 'part', 'interface_id'), ('flow', 'kind', NULL), ('flow_step', 'kind', NULL), ('view', 'kind', NULL), ('view_requirement', 'kind', NULL),
  ('endpoint', 'kind', NULL), ('api_requirement', 'kind', NULL), ('integration', 'kind', NULL);
