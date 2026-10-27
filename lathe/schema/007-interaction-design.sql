-- Interaction design: flows and their steps, views, APIs with their shapes and endpoints, integrations, and
-- interaction requirements.

CREATE TABLE flow (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  domain_id VARCHAR NOT NULL REFERENCES domain (id),
  capability_id VARCHAR,
  description VARCHAR,
  FOREIGN KEY (capability_id, domain_id) REFERENCES capability (id, domain_id),
  UNIQUE (id, domain_id)
);
COMMENT ON TABLE flow IS 'An end-to-end path through views and endpoints that carries out one or more use cases. Its steps are flow_step records.';
COMMENT ON COLUMN flow.id IS 'The flow''s ID, such as TL-LEND-F01.';
COMMENT ON COLUMN flow.title IS 'The flow''s name, such as Borrow and return a tool.';
COMMENT ON COLUMN flow.domain_id IS 'The domain it belongs to.';
COMMENT ON COLUMN flow.capability_id IS 'The capability of that domain it sits in, if one.';
COMMENT ON COLUMN flow.description IS 'The path, in a paragraph.';

CREATE TABLE flow_step (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  flow_id VARCHAR NOT NULL REFERENCES flow (id),
  path VARCHAR NOT NULL CHECK (trim(path) <> ''),
  position INTEGER NOT NULL CHECK (position >= 1),
  description VARCHAR,
  UNIQUE (flow_id, path, position)
);
COMMENT ON TABLE flow_step IS 'One step of a flow, in order on its path: what happens, through which view, endpoint or component, and what the step carries out.';
COMMENT ON COLUMN flow_step.id IS 'The step''s ID: its flow''s ID and S<nn>, such as TL-LEND-F01-S01.';
COMMENT ON COLUMN flow_step.title IS 'What happens, in a few words.';
COMMENT ON COLUMN flow_step.flow_id IS 'The flow it belongs to.';
COMMENT ON COLUMN flow_step.path IS 'The path through the flow the step is on, such as main or refused.';
COMMENT ON COLUMN flow_step.position IS 'The step''s place on its path, from 1.';
COMMENT ON COLUMN flow_step.description IS 'What happens in the step, in a sentence or two.';

CREATE TABLE view (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  domain_id VARCHAR NOT NULL REFERENCES domain (id),
  route VARCHAR,
  description VARCHAR,
  notes VARCHAR,
  UNIQUE (id, domain_id)
);
COMMENT ON TABLE view IS 'A screen or page a person uses.';
COMMENT ON COLUMN view.id IS 'The view''s ID, such as TL-LEND-V01.';
COMMENT ON COLUMN view.title IS 'The view''s name, such as Catalog.';
COMMENT ON COLUMN view.domain_id IS 'The domain it belongs to.';
COMMENT ON COLUMN view.route IS 'The address it is shown at, such as /<domain-id>.';
COMMENT ON COLUMN view.description IS 'What the view shows and lets a person do, in a paragraph.';
COMMENT ON COLUMN view.notes IS 'Longer notes on the view.';

CREATE TABLE api (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  domain_id VARCHAR NOT NULL REFERENCES domain (id),
  description VARCHAR,
  UNIQUE (id, domain_id)
);
COMMENT ON TABLE api IS 'A group of endpoints for one resource, such as Loans: it holds the resource''s endpoints and the interaction requirements that hold for every endpoint in it. The shapes its endpoints share are api_shape rows.';
COMMENT ON COLUMN api.id IS 'The API''s ID, such as TL-LEND-API01.';
COMMENT ON COLUMN api.title IS 'The resource''s name, such as Loans.';
COMMENT ON COLUMN api.domain_id IS 'The domain it belongs to.';
COMMENT ON COLUMN api.description IS 'The resource and where it is served, in a sentence or two.';

CREATE TABLE api_shape (
  api_id VARCHAR NOT NULL REFERENCES api (id),
  position INTEGER NOT NULL CHECK (position >= 1),
  name VARCHAR NOT NULL CHECK (trim(name) <> ''),
  meaning VARCHAR NOT NULL CHECK (trim(meaning) <> ''),
  fields VARCHAR NOT NULL CHECK (trim(fields) <> ''),
  PRIMARY KEY (api_id, position),
  UNIQUE (api_id, name)
);
COMMENT ON TABLE api_shape IS 'One request or response shape an API''s endpoints share, in order.';
COMMENT ON COLUMN api_shape.api_id IS 'The API.';
COMMENT ON COLUMN api_shape.position IS 'The shape''s place in the API, from 1.';
COMMENT ON COLUMN api_shape.name IS 'The shape''s name, such as Loan.';
COMMENT ON COLUMN api_shape.meaning IS 'What the shape stands for.';
COMMENT ON COLUMN api_shape.fields IS 'Its fields, such as id, memberId, toolId.';

CREATE TYPE http_method AS ENUM ('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS');

CREATE TABLE endpoint (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  domain_id VARCHAR NOT NULL REFERENCES domain (id),
  api_id VARCHAR,
  method http_method NOT NULL,
  route VARCHAR NOT NULL CHECK (trim(route) <> ''),
  description VARCHAR,
  notes VARCHAR,
  FOREIGN KEY (api_id, domain_id) REFERENCES api (id, domain_id),
  UNIQUE (id, domain_id)
);
COMMENT ON TABLE endpoint IS 'An HTTP endpoint: its method, route, request and responses. It sits in the API for its resource, or in the domain.';
COMMENT ON COLUMN endpoint.id IS 'The endpoint''s ID, such as TL-LEND-E01.';
COMMENT ON COLUMN endpoint.title IS 'What the endpoint does, such as Borrow a tool.';
COMMENT ON COLUMN endpoint.domain_id IS 'The domain it belongs to.';
COMMENT ON COLUMN endpoint.api_id IS 'The API of that domain it sits in, if one.';
COMMENT ON COLUMN endpoint.method IS 'The HTTP method.';
COMMENT ON COLUMN endpoint.route IS 'The route, such as /loans or /tools/{toolId}/damage.';
COMMENT ON COLUMN endpoint.description IS 'Its request and responses, in a sentence or two.';
COMMENT ON COLUMN endpoint.notes IS 'Longer notes on the endpoint.';

CREATE TABLE integration (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  domain_id VARCHAR NOT NULL REFERENCES domain (id),
  system VARCHAR,
  description VARCHAR,
  UNIQUE (id, domain_id)
);
COMMENT ON TABLE integration IS 'An outside system the domain exchanges with, such as a payment provider or a mail service. It holds one interaction requirement per exchange.';
COMMENT ON COLUMN integration.id IS 'The integration''s ID, such as TL-LEND-INT01.';
COMMENT ON COLUMN integration.title IS 'The integration''s name.';
COMMENT ON COLUMN integration.domain_id IS 'The domain it belongs to.';
COMMENT ON COLUMN integration.system IS 'The outside system, such as Stripe.';
COMMENT ON COLUMN integration.description IS 'What the domain exchanges with it, in a sentence or two.';

CREATE TABLE interaction_requirement (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  domain_id VARCHAR NOT NULL REFERENCES domain (id),
  view_id VARCHAR,
  endpoint_id VARCHAR,
  flow_id VARCHAR,
  api_id VARCHAR,
  integration_id VARCHAR,
  statement VARCHAR NOT NULL CHECK (trim(statement) <> ''),
  group_name VARCHAR,
  FOREIGN KEY (view_id, domain_id) REFERENCES view (id, domain_id),
  FOREIGN KEY (endpoint_id, domain_id) REFERENCES endpoint (id, domain_id),
  FOREIGN KEY (flow_id, domain_id) REFERENCES flow (id, domain_id),
  FOREIGN KEY (api_id, domain_id) REFERENCES api (id, domain_id),
  FOREIGN KEY (integration_id, domain_id) REFERENCES integration (id, domain_id),
  CHECK ((view_id IS NOT NULL)::INTEGER + (endpoint_id IS NOT NULL)::INTEGER + (flow_id IS NOT NULL)::INTEGER
    + (api_id IS NOT NULL)::INTEGER + (integration_id IS NOT NULL)::INTEGER <= 1)
);
COMMENT ON TABLE interaction_requirement IS 'One rule a view, endpoint, flow, API or integration must follow, such as a field''s limits, an error''s response or one exchange with an outside system. One under an API holds for every endpoint in it; one with none of them holds across the domain''s interaction design.';
COMMENT ON COLUMN interaction_requirement.id IS 'The requirement''s ID: its parent''s ID and R<nn>, such as TL-LEND-E03-R01, or <P>-<D>-IR<nn> under the domain.';
COMMENT ON COLUMN interaction_requirement.title IS 'The requirement in a few words.';
COMMENT ON COLUMN interaction_requirement.domain_id IS 'The domain it belongs to.';
COMMENT ON COLUMN interaction_requirement.view_id IS 'The view of that domain it holds for, if one.';
COMMENT ON COLUMN interaction_requirement.endpoint_id IS 'The endpoint of that domain it holds for, if one.';
COMMENT ON COLUMN interaction_requirement.flow_id IS 'The flow of that domain it holds for, if one.';
COMMENT ON COLUMN interaction_requirement.api_id IS 'The API of that domain it holds for, for every endpoint in it, if one.';
COMMENT ON COLUMN interaction_requirement.integration_id IS 'The integration of that domain whose exchange it states, if one.';
COMMENT ON COLUMN interaction_requirement.statement IS 'The requirement, stated with MUST, MUST NOT, SHOULD or MAY.';
COMMENT ON COLUMN interaction_requirement.group_name IS 'A short heading it is shown under among its siblings, such as Validation or Paging.';

INSERT INTO meta_kind VALUES
  ('flow', 'Flow', 'design', 'interaction-design', 'none', '<P>-<D>-F<nn>', 'TL-LEND-F01', NULL),
  ('flow_step', 'Flow step', 'design', 'interaction-design', 'none', '<flow>-S<nn>', 'TL-LEND-F01-S01', NULL),
  ('view', 'View', 'design', 'interaction-design', 'none', '<P>-<D>-V<nn>', 'TL-LEND-V01', NULL),
  ('api', 'API', 'design', 'interaction-design', 'none', '<P>-<D>-API<nn>', 'TL-LEND-API01', NULL),
  ('endpoint', 'Endpoint', 'design', 'interaction-design', 'none', '<P>-<D>-E<nn>', 'TL-LEND-E01', NULL),
  ('integration', 'Integration', 'design', 'interaction-design', 'none', '<P>-<D>-INT<nn>', 'TL-LEND-INT01', NULL),
  ('interaction_requirement', 'Interaction requirement', 'design', 'interaction-design', 'full',
    '<view, endpoint, flow, API or integration>-R<nn>, or <P>-<D>-IR<nn> under the domain', 'TL-LEND-E03-R01', NULL);
INSERT INTO meta_kind_parent VALUES
  ('flow', 'capability', 1, 'capability_id'), ('flow', 'domain', 2, 'domain_id'),
  ('flow_step', 'flow', 1, 'flow_id'),
  ('view', 'domain', 1, 'domain_id'),
  ('api', 'domain', 1, 'domain_id'),
  ('endpoint', 'api', 1, 'api_id'), ('endpoint', 'domain', 2, 'domain_id'),
  ('integration', 'domain', 1, 'domain_id'),
  ('interaction_requirement', 'view', 1, 'view_id'), ('interaction_requirement', 'endpoint', 2, 'endpoint_id'),
  ('interaction_requirement', 'flow', 3, 'flow_id'), ('interaction_requirement', 'api', 4, 'api_id'),
  ('interaction_requirement', 'integration', 5, 'integration_id'), ('interaction_requirement', 'domain', 6, 'domain_id');
INSERT INTO meta_table VALUES
  ('flow', 'kind', NULL), ('flow_step', 'kind', NULL), ('view', 'kind', NULL), ('api', 'kind', NULL),
  ('api_shape', 'part', 'api_id'), ('endpoint', 'kind', NULL), ('integration', 'kind', NULL), ('interaction_requirement', 'kind', NULL);
