CREATE TABLE IF NOT EXISTS quote_revision_snapshots (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  revision_id UUID NOT NULL,
  wardrobe_config_json JSONB NOT NULL,
  bom_json JSONB NOT NULL,
  edge_json JSONB NOT NULL,
  labor_json JSONB NOT NULL,
  cost_json JSONB NOT NULL,
  formula_version TEXT NOT NULL,
  config_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, revision_id, config_hash),
  FOREIGN KEY (company_id, revision_id) REFERENCES quote_revisions(company_id, id)
);

CREATE TABLE IF NOT EXISTS quote_documents (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  revision_id UUID NOT NULL,
  cost_snapshot_id UUID NOT NULL,
  cost_snapshot_hash TEXT NOT NULL,
  formula_version TEXT NOT NULL,
  document_type TEXT NOT NULL,
  content_type TEXT NOT NULL,
  html TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, revision_id, sha256),
  FOREIGN KEY (company_id, revision_id) REFERENCES quote_revisions(company_id, id)
);
