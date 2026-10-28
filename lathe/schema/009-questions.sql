-- Open questions, which sit outside the stages, under their product or one of its domains.

CREATE TABLE question (
  id VARCHAR PRIMARY KEY REFERENCES record_id (id),
  title VARCHAR NOT NULL CHECK (trim(title) <> ''),
  product_id VARCHAR REFERENCES product (id),
  domain_id VARCHAR REFERENCES domain (id),
  owner VARCHAR NOT NULL CHECK (trim(owner) <> ''),
  description VARCHAR,
  CHECK ((product_id IS NULL) <> (domain_id IS NULL))
);
COMMENT ON TABLE question IS 'Something undecided, with the role that decides it. It sits under its product or one of its domains, and may be about any record (the about link). A decided question is removed and its answer written into the records it affects.';
COMMENT ON COLUMN question.id IS 'The question''s ID: its product''s or domain''s ID and Q<nn>, such as TL-LEND-Q01 or TL-Q01.';
COMMENT ON COLUMN question.title IS 'The question.';
COMMENT ON COLUMN question.product_id IS 'The product it sits under, for a question of the whole product; exactly one of product and domain is given.';
COMMENT ON COLUMN question.domain_id IS 'The domain it sits under; exactly one of product and domain is given.';
COMMENT ON COLUMN question.owner IS 'The role that decides it, one of the product''s roles, such as Owner.';
COMMENT ON COLUMN question.description IS 'What is open, and the options.';

INSERT INTO meta_kind VALUES ('question', 'Open question', NULL, 58, false, '<P>-Q<nn> or <P>-<D>-Q<nn>', 'TL-LEND-Q01', 'parent', NULL);
INSERT INTO meta_kind_parent VALUES ('question', 'product', 1, 'product_id'), ('question', 'domain', 2, 'domain_id');
INSERT INTO meta_table VALUES ('question', 'kind', NULL);
