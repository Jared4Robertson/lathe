-- The technical specification: layers, components, and technical flows with their steps.

CREATE TABLE layer (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  domain_id VARCHAR NOT NULL REFERENCES domain (id),
  parent_layer_id VARCHAR,
  position INTEGER NOT NULL CHECK (position >= 1),
  description VARCHAR,
  UNIQUE (id, domain_id),
  FOREIGN KEY (parent_layer_id, domain_id) REFERENCES layer (id, domain_id),
  CHECK (parent_layer_id IS NULL OR parent_layer_id <> id)
);
COMMENT ON TABLE layer IS 'An ordered part of a domain''s technical specification that groups its components by what they are, such as Models, Services or Web app. It sits in the domain, or in another layer of it as a sub-layer.';
COMMENT ON COLUMN layer.id IS 'The layer''s ID, such as TL-LEND-LAY01.';
COMMENT ON COLUMN layer.title IS 'The layer''s name, such as Services.';
COMMENT ON COLUMN layer.domain_id IS 'The domain it belongs to.';
COMMENT ON COLUMN layer.parent_layer_id IS 'The layer of that domain it sits in as a sub-layer, if one.';
COMMENT ON COLUMN layer.position IS 'Its place among the layers beside it, from 1.';
COMMENT ON COLUMN layer.description IS 'What the layer holds, in a sentence or two.';

CREATE TABLE component (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  domain_id VARCHAR NOT NULL REFERENCES domain (id),
  layer_id VARCHAR,
  component_type VARCHAR NOT NULL CHECK (regexp_full_match(component_type, '[a-z][a-z0-9_-]*')),
  file VARCHAR NOT NULL CHECK (trim(file) <> ''),
  description VARCHAR,
  FOREIGN KEY (layer_id, domain_id) REFERENCES layer (id, domain_id),
  UNIQUE (id, domain_id)
);
COMMENT ON TABLE component IS 'A unit of code in the target design, such as a model, service or router. It sits in a layer of its domain, or in the domain when the domain has no layers.';
COMMENT ON COLUMN component.id IS 'The component''s ID, such as TL-LEND-C01.';
COMMENT ON COLUMN component.title IS 'The component''s name, often its file name.';
COMMENT ON COLUMN component.domain_id IS 'The domain it belongs to.';
COMMENT ON COLUMN component.layer_id IS 'The layer of that domain it sits in, if one.';
COMMENT ON COLUMN component.component_type IS 'What kind of code it is, in lower case, such as service or module.';
COMMENT ON COLUMN component.file IS 'The file that holds its code, from the product root; it may not exist yet.';
COMMENT ON COLUMN component.description IS 'What the code does, in a paragraph.';

CREATE TABLE design_flow (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  domain_id VARCHAR NOT NULL REFERENCES domain (id),
  layer_id VARCHAR,
  description VARCHAR,
  notes VARCHAR,
  FOREIGN KEY (layer_id, domain_id) REFERENCES layer (id, domain_id)
);
COMMENT ON TABLE design_flow IS 'A technical flow: how the system carries out a flow. It deepens the flow, and its design_step records say, in order, which component does each part and what it designs.';
COMMENT ON COLUMN design_flow.id IS 'The technical flow''s ID, such as TL-LEND-DF01.';
COMMENT ON COLUMN design_flow.title IS 'What the system carries out, such as Load and check a workspace.';
COMMENT ON COLUMN design_flow.domain_id IS 'The domain it belongs to.';
COMMENT ON COLUMN design_flow.layer_id IS 'The layer of that domain it sits in, if one.';
COMMENT ON COLUMN design_flow.description IS 'How the system carries it out, in a paragraph.';
COMMENT ON COLUMN design_flow.notes IS 'Its failures, limits and signals.';

CREATE TABLE design_step (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  design_flow_id VARCHAR NOT NULL REFERENCES design_flow (id),
  path VARCHAR NOT NULL CHECK (trim(path) <> ''),
  position INTEGER NOT NULL CHECK (position >= 1),
  description VARCHAR,
  transaction_name VARCHAR,
  locks VARCHAR,
  statements VARCHAR,
  UNIQUE (design_flow_id, path, position)
);
COMMENT ON TABLE design_step IS 'One step of a technical flow, in order on its path: what the system does, the component that does it (uses) and the obligations it designs (satisfies).';
COMMENT ON COLUMN design_step.id IS 'The step''s ID: its technical flow''s ID and S<nn>, such as TL-LEND-DF01-S01.';
COMMENT ON COLUMN design_step.title IS 'What the system does, in a few words.';
COMMENT ON COLUMN design_step.design_flow_id IS 'The technical flow it belongs to.';
COMMENT ON COLUMN design_step.path IS 'The path through the flow the step is on, such as main.';
COMMENT ON COLUMN design_step.position IS 'The step''s place on its path, from 1.';
COMMENT ON COLUMN design_step.description IS 'What the system does in the step, in a sentence or two.';
COMMENT ON COLUMN design_step.transaction_name IS 'The transaction the step runs in.';
COMMENT ON COLUMN design_step.locks IS 'What the step locks.';
COMMENT ON COLUMN design_step.statements IS 'How many statements the step runs, such as one SELECT per check file.';

INSERT INTO meta_kind VALUES
  ('layer', 'Layer', 'design', 'technical-specification', 'none', '<P>-<D>-LAY<nn>', 'TL-LEND-LAY01', NULL),
  ('component', 'Component', 'design', 'technical-specification', 'none', '<P>-<D>-C<nn>', 'TL-LEND-C01', NULL),
  ('design_flow', 'Technical flow', 'design', 'technical-specification', 'none', '<P>-<D>-DF<nn>', 'TL-LEND-DF01', NULL),
  ('design_step', 'Technical step', 'design', 'technical-specification', 'none', '<technical flow>-S<nn>', 'TL-LEND-DF01-S01', NULL);
INSERT INTO meta_kind_parent VALUES
  ('layer', 'layer', 1, 'parent_layer_id'), ('layer', 'domain', 2, 'domain_id'),
  ('component', 'layer', 1, 'layer_id'), ('component', 'domain', 2, 'domain_id'),
  ('design_flow', 'layer', 1, 'layer_id'), ('design_flow', 'domain', 2, 'domain_id'),
  ('design_step', 'design_flow', 1, 'design_flow_id');
INSERT INTO meta_table VALUES ('layer', 'kind', NULL), ('component', 'kind', NULL), ('design_flow', 'kind', NULL), ('design_step', 'kind', NULL);
