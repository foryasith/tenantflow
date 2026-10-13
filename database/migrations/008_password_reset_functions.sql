
-- Migration 008: Secure Password Reset Functions
-- Uses the existing password_reset_tokens table.
-- Functions execute with table-owner privileges.
-- Do not expose the application DB credentials publicly.

-- 1. Create a time-limited password reset request.
CREATE OR REPLACE FUNCTION public.issue_password_reset(
    p_slug TEXT,
    p_email TEXT,
    p_token_hash TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    IF p_token_hash !~ '^[a-f0-9]{64}$' THEN
        RAISE EXCEPTION 'Invalid token hash';
    END IF;

    SELECT u.id INTO v_user_id
    FROM public.users u
    JOIN public.organizations o
      ON o.id = u.organization_id
    WHERE o.slug = p_slug
      AND lower(u.email) = lower(trim(p_email))
    LIMIT 1;

    IF v_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Invalidate earlier reset requests.
    DELETE FROM public.password_reset_tokens
    WHERE user_id = v_user_id;

    INSERT INTO public.password_reset_tokens (
        user_id,
        token_hash,
        expires_at
    )
    VALUES (
        v_user_id,
        p_token_hash,
        NOW() + INTERVAL '15 minutes'
    );

    RETURN TRUE;
END;
$$;

-- 2. Consume token and update password atomically.
CREATE OR REPLACE FUNCTION public.consume_password_reset(
    p_token_hash TEXT,
    p_new_password_hash TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_token_id UUID;
    v_user_id UUID;
BEGIN
    IF p_token_hash !~ '^[a-f0-9]{64}$'
       OR p_new_password_hash
          !~ '^\$2[aby]\$12\$'
    THEN
        RETURN FALSE;
    END IF;

    -- Lock the token against simultaneous reset attempts.
    SELECT id, user_id
    INTO v_token_id, v_user_id
    FROM public.password_reset_tokens
    WHERE token_hash = p_token_hash
      AND used_at IS NULL
      AND expires_at > NOW()
    FOR UPDATE;

    IF v_token_id IS NULL THEN
        RETURN FALSE;
    END IF;

    UPDATE public.users
    SET password_hash = p_new_password_hash
    WHERE id = v_user_id;

    UPDATE public.password_reset_tokens
    SET used_at = NOW()
    WHERE id = v_token_id;

    -- Sign out all active sessions for the account.
    DELETE FROM public.auth_sessions
    WHERE user_id = v_user_id;

    -- Invalidate any other reset tokens for this user.
    DELETE FROM public.password_reset_tokens
    WHERE user_id = v_user_id
      AND id <> v_token_id;

    RETURN TRUE;
END;
$$;

-- Restrict execution to the backend application role.
REVOKE ALL ON FUNCTION public.issue_password_reset(
    TEXT, TEXT, TEXT
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.consume_password_reset(
    TEXT, TEXT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.issue_password_reset(
    TEXT, TEXT, TEXT
) TO tenantflow_app;

GRANT EXECUTE ON FUNCTION public.consume_password_reset(
    TEXT, TEXT
) TO tenantflow_app;
