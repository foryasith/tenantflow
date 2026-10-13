
-- TenantFlow Migration 009
-- Persistent authentication rate limiting

CREATE TABLE public.auth_rate_limits (
    rate_key TEXT PRIMARY KEY,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    window_expires_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_attempt_count
        CHECK (attempt_count >= 0)
);

CREATE INDEX idx_auth_rate_limits_expiry
ON public.auth_rate_limits(window_expires_at);

ALTER TABLE public.auth_rate_limits
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.auth_rate_limits
FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.auth_rate_limits
FROM PUBLIC;

REVOKE ALL ON TABLE public.auth_rate_limits
FROM tenantflow_app;


-- Atomically check and increment a rate-limit counter.
-- Returns TRUE while request is allowed.
-- Returns FALSE once the limit is exceeded.

CREATE FUNCTION public.check_auth_rate_limit(
    p_rate_key TEXT,
    p_max_attempts INTEGER,
    p_window_seconds INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_attempt_count INTEGER;
    v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
    IF p_rate_key IS NULL
       OR length(p_rate_key) <> 64
       OR p_rate_key !~ '^[a-f0-9]{64}$'
       OR p_max_attempts NOT BETWEEN 1 AND 100
       OR p_window_seconds NOT BETWEEN 60 AND 86400
    THEN
        RAISE EXCEPTION 'Invalid rate limit parameters';
    END IF;

    INSERT INTO public.auth_rate_limits (
        rate_key,
        attempt_count,
        window_expires_at,
        updated_at
    )
    VALUES (
        p_rate_key,
        1,
        v_now + (p_window_seconds * INTERVAL '1 second'),
        v_now
    )
    ON CONFLICT (rate_key)
    DO UPDATE SET
        attempt_count =
            CASE
                WHEN auth_rate_limits.window_expires_at <= v_now
                THEN 1
                ELSE auth_rate_limits.attempt_count + 1
            END,

        window_expires_at =
            CASE
                WHEN auth_rate_limits.window_expires_at <= v_now
                THEN v_now + (
                    p_window_seconds * INTERVAL '1 second'
                )
                ELSE auth_rate_limits.window_expires_at
            END,

        updated_at = v_now

    RETURNING attempt_count
    INTO v_attempt_count;

    RETURN v_attempt_count <= p_max_attempts;
END;
$$;

REVOKE ALL ON FUNCTION public.check_auth_rate_limit(
    TEXT, INTEGER, INTEGER
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.check_auth_rate_limit(
    TEXT, INTEGER, INTEGER
) TO tenantflow_app;
