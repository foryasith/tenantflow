
-- Migration 006: Revoke Authentication Session

CREATE OR REPLACE FUNCTION public.revoke_auth_session(
    p_token_hash TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM public.auth_sessions
    WHERE token_hash = p_token_hash;

    GET DIAGNOSTICS v_deleted = ROW_COUNT;

    RETURN v_deleted > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_auth_session(TEXT)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.revoke_auth_session(TEXT)
TO tenantflow_app;
