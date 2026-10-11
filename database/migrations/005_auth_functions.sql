
-- Migration 005: Authentication Helper Functions

-- Look up a user within a named organization.
-- Called only by the trusted authentication backend.
CREATE OR REPLACE FUNCTION public.find_login_user(
    p_slug TEXT,
    p_email TEXT
)
RETURNS TABLE (
    user_id UUID,
    tenant_id UUID,
    full_name VARCHAR,
    password_hash TEXT,
    role_name VARCHAR
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT
        u.id,
        u.organization_id,
        u.full_name,
        u.password_hash,
        r.name
    FROM public.users u
    JOIN public.organizations o
      ON o.id = u.organization_id
    JOIN public.roles r
      ON r.id = u.role_id
    WHERE o.slug = p_slug
      AND lower(u.email) = lower(p_email)
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.find_login_user(
    TEXT, TEXT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.find_login_user(
    TEXT, TEXT
) TO tenantflow_app;

-- Create a new authenticated session.
CREATE OR REPLACE FUNCTION public.create_auth_session(
    p_user_id UUID,
    p_tenant_id UUID,
    p_token_hash TEXT,
    p_expires_at TIMESTAMPTZ
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_session_id UUID;
BEGIN
    INSERT INTO public.auth_sessions (
        user_id,
        organization_id,
        token_hash,
        expires_at
    )
    VALUES (
        p_user_id,
        p_tenant_id,
        p_token_hash,
        p_expires_at
    )
    RETURNING id INTO v_session_id;

    RETURN v_session_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_auth_session(
    UUID, UUID, TEXT, TIMESTAMPTZ
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_auth_session(
    UUID, UUID, TEXT, TIMESTAMPTZ
) TO tenantflow_app;

-- Resolve an existing session.
CREATE OR REPLACE FUNCTION public.get_auth_session(
    p_token_hash TEXT
)
RETURNS TABLE (
    user_id UUID,
    tenant_id UUID,
    full_name VARCHAR,
    email VARCHAR,
    role_name VARCHAR
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT
        u.id,
        u.organization_id,
        u.full_name,
        u.email,
        r.name
    FROM public.auth_sessions s
    JOIN public.users u ON u.id = s.user_id
    JOIN public.roles r ON r.id = u.role_id
    WHERE s.token_hash = p_token_hash
      AND s.expires_at > NOW()
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_auth_session(TEXT)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_auth_session(TEXT)
TO tenantflow_app;
