CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'TRY',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, email),
  UNIQUE (company_id, id)
);

CREATE TABLE IF NOT EXISTS user_roles (
  company_id UUID NOT NULL REFERENCES companies(id),
  user_id UUID NOT NULL,
  role TEXT NOT NULL,
  PRIMARY KEY (company_id, user_id, role),
  FOREIGN KEY (company_id, user_id) REFERENCES users(company_id, id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  user_id UUID NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  FOREIGN KEY (company_id, user_id) REFERENCES users(company_id, id)
);

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, id)
);

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  customer_id UUID,
  customer_name TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, id),
  FOREIGN KEY (company_id, customer_id) REFERENCES customers(company_id, id)
);

CREATE TABLE IF NOT EXISTS material_skus (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  thickness_mm INTEGER NOT NULL CHECK (thickness_mm > 0),
  sheet_width_mm INTEGER NOT NULL CHECK (sheet_width_mm > 0),
  sheet_height_mm INTEGER NOT NULL CHECK (sheet_height_mm > 0),
  version INTEGER NOT NULL DEFAULT 1,
  UNIQUE (company_id, sku),
  UNIQUE (company_id, id)
);

CREATE TABLE IF NOT EXISTS price_observations (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  supplier_name TEXT NOT NULL,
  sku TEXT NOT NULL,
  currency CHAR(3) NOT NULL,
  unit TEXT NOT NULL,
  price_minor BIGINT NOT NULL CHECK (price_minor >= 0),
  observed_at TIMESTAMPTZ NOT NULL,
  source_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quote_revisions (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  project_id UUID NOT NULL,
  revision_number INTEGER NOT NULL,
  state TEXT NOT NULL DEFAULT 'draft',
  parent_revision_id UUID,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, id),
  UNIQUE (company_id, project_id, revision_number),
  FOREIGN KEY (company_id, project_id) REFERENCES projects(company_id, id),
  FOREIGN KEY (company_id, parent_revision_id) REFERENCES quote_revisions(company_id, id),
  CHECK (state IN ('draft', 'approved', 'sent'))
);

CREATE TABLE IF NOT EXISTS outbox_events (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  event_type TEXT NOT NULL,
  aggregate_id UUID NOT NULL,
  payload JSONB NOT NULL,
  correlation_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS audit_entries (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  actor_id UUID,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  correlation_id TEXT NOT NULL,
  decision TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_company ON projects(company_id);
CREATE INDEX IF NOT EXISTS idx_quote_revisions_company_project ON quote_revisions(company_id, project_id);
CREATE INDEX IF NOT EXISTS idx_audit_company_created ON audit_entries(company_id, created_at DESC);
