
-- Migration 007: Password Reset Token Storage
-- Reset tokens expire after 15 minutes.
-- Only token hashes are stored in the database.

CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    token_hash CHAR(64) NOT NULL UNIQUE,

    expires_at TIMESTAMPTZ NOT NULL,

    used_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_reset_expiry
        CHECK (expires_at > created_at)
);

CREATE INDEX idx_password_reset_user
ON password_reset_tokens(user_id);

CREATE INDEX idx_password_reset_expiry
ON password_reset_tokens(expires_at);

-- Block direct access by the application role.
ALTER TABLE password_reset_tokens
ENABLE ROW LEVEL SECURITY;

ALTER TABLE password_reset_tokens
FORCE ROW LEVEL SECURITY;

REVOKE ALL ON password_reset_tokens
FROM PUBLIC;

REVOKE ALL ON password_reset_tokens
FROM tenantflow_app;
