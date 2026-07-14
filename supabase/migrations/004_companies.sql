-- Migration 004: Companies master data table
-- Untuk dropdown search di AVAILABLE→RESERVED, dll

-- Drop if exists from older migration
DROP TABLE IF EXISTS companies CASCADE;

CREATE TABLE companies (
    company_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name VARCHAR(255) NOT NULL UNIQUE,
    address TEXT,
    phone VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_companies_name ON companies(company_name);
CREATE INDEX idx_companies_active ON companies(is_active);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users read companies" ON companies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users insert companies" ON companies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users update companies" ON companies FOR UPDATE TO authenticated USING (true);
