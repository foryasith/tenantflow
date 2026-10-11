
-- TenantFlow Week 1
-- Migration 002: PostgreSQL Row-Level Security

-- Create restricted application role
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_roles
        WHERE rolname = 'tenantflow_app'
    ) THEN
        CREATE ROLE tenantflow_app
        WITH LOGIN PASSWORD 'local_app_password';
    END IF;
END
$$;

-- Grant application permissions
GRANT CONNECT ON DATABASE tenantflow TO tenantflow_app;

GRANT USAGE ON SCHEMA public TO tenantflow_app;

GRANT SELECT ON organizations, roles
TO tenantflow_app;

GRANT SELECT, INSERT, UPDATE, DELETE
ON users, bookings TO tenantflow_app;

-- Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Force table owners to obey RLS
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE bookings FORCE ROW LEVEL SECURITY;

-- Organization isolation
DROP POLICY IF EXISTS organization_isolation ON organizations;

CREATE POLICY organization_isolation
ON organizations
FOR SELECT TO tenantflow_app
USING (
    id = NULLIF(
        current_setting('app.tenant_id', true), ''
    )::uuid
);

-- User isolation
DROP POLICY IF EXISTS users_isolation ON users;

CREATE POLICY users_isolation
ON users
FOR ALL TO tenantflow_app
USING (
    organization_id = NULLIF(
        current_setting('app.tenant_id', true), ''
    )::uuid
)
WITH CHECK (
    organization_id = NULLIF(
        current_setting('app.tenant_id', true), ''
    )::uuid
);

-- Booking isolation
DROP POLICY IF EXISTS bookings_isolation ON bookings;

CREATE POLICY bookings_isolation
ON bookings
FOR ALL TO tenantflow_app
USING (
    organization_id = NULLIF(
        current_setting('app.tenant_id', true), ''
    )::uuid
)
WITH CHECK (
    organization_id = NULLIF(
        current_setting('app.tenant_id', true), ''
    )::uuid
);
