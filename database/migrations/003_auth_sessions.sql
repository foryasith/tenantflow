
-- Migration 003: Authentication Sessions

CREATE TABLE auth_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    organization_id UUID NOT NULL
        REFERENCES organizations(id) ON DELETE CASCADE,

    token_hash TEXT NOT NULL UNIQUE,

    expires_at TIMESTAMPTZ NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_session_user_tenant
        FOREIGN KEY (organization_id, user_id)
        REFERENCES users(organization_id, id)
);

CREATE INDEX idx_auth_sessions_user
ON auth_sessions(user_id);

CREATE INDEX idx_auth_sessions_expiry
ON auth_sessions(expires_at);

ALTER TABLE auth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_sessions FORCE ROW LEVEL SECURITY;

-- No direct application access is granted yet.
-- Session access will use a restricted authentication
-- mechanism rather than accepting arbitrary tenant IDs.
