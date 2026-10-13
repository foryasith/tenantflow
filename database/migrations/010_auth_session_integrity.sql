
-- Migration 010: Authentication Session Integrity Hardening
--
-- Goals:
-- 1. Validate session token hash format.
-- 2. Reject expired or excessively long sessions.
-- 3. Ensure session user belongs to the stated tenant.
-- 4. Check tenant consistency when resolving sessions.
--
-- This migration does not change existing function
-- signatures or revoke permissions used by the app.
--
-- IMPORTANT:
-- This is input-integrity hardening, not full protection
-- against compromised application database credentials.

BEGIN;

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
AS $function$
DECLARE
    v_session_id UUID;
BEGIN
    -- Required identifiers
    IF p_user_id IS NULL OR p_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Invalid session identity'
            USING ERRCODE = '22023';
    END IF;

    -- SHA-256 hex digest is exactly 64 lowercase characters.
    IF p_token_hash IS NULL
       OR p_token_hash !~ '^[0-9a-f]{64}$'
    THEN
        RAISE EXCEPTION 'Invalid session token hash'
            USING ERRCODE = '22023';
    END IF;

    -- Sessions must be in the future and cannot
    -- exceed the application lifetime by a wide margin.
    -- Five minutes is allowed for minor clock differences.
    IF p_expires_at IS NULL
       OR p_expires_at <= pg_catalog.clock_timestamp()
       OR p_expires_at >
          pg_catalog.clock_timestamp()
            + INTERVAL '7 days 5 minutes'
    THEN
        RAISE EXCEPTION 'Invalid session expiration'
            USING ERRCODE = '22023';
    END IF;

    -- Ensure the requested user belongs to the tenant.
    -- The existing composite foreign key provides
    -- an additional database-level integrity guarantee.
    IF NOT EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = p_user_id
          AND u.organization_id = p_tenant_id
    ) THEN
        RAISE EXCEPTION 'Invalid session identity'
            USING ERRCODE = '22023';
    END IF;

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
$function$;

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
AS $function$
    SELECT
        u.id,
        u.organization_id,
        u.full_name,
        u.email,
        r.name
    FROM public.auth_sessions s
    JOIN public.users u
      ON u.id = s.user_id
     AND u.organization_id = s.organization_id
    JOIN public.roles r
      ON r.id = u.role_id
    WHERE s.token_hash = p_token_hash
      AND s.expires_at > pg_catalog.clock_timestamp()
    LIMIT 1;
$function$;

-- Preserve application execution access and explicitly
-- keep PUBLIC execution revoked.
REVOKE ALL ON FUNCTION public.create_auth_session(
    UUID, UUID, TEXT, TIMESTAMPTZ
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_auth_session(
    UUID, UUID, TEXT, TIMESTAMPTZ
) TO tenantflow_app;

REVOKE ALL ON FUNCTION public.get_auth_session(TEXT)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_auth_session(TEXT)
TO tenantflow_app;

COMMIT;
