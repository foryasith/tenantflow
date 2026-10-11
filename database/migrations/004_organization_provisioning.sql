
-- Migration 004: Secure Organization Provisioning

CREATE OR REPLACE FUNCTION public.register_organization(
    p_name TEXT,
    p_slug TEXT,
    p_owner_name TEXT,
    p_email TEXT,
    p_password_hash TEXT
)
RETURNS TABLE (
    organization_id UUID,
    owner_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_org_id UUID;
    v_owner_id UUID;
    v_owner_role_id UUID;
BEGIN
    IF length(trim(p_name)) < 2
       OR length(trim(p_owner_name)) < 2
       OR p_slug !~ '^[a-z0-9-]{3,100}$'
       OR length(p_email) > 255
       OR p_email NOT LIKE '%@%'
       OR length(p_password_hash) < 50
    THEN
        RAISE EXCEPTION 'Invalid registration data';
    END IF;

    SELECT id INTO v_owner_role_id
    FROM public.roles
    WHERE name = 'OWNER';

    IF v_owner_role_id IS NULL THEN
        RAISE EXCEPTION 'OWNER role missing';
    END IF;

    INSERT INTO public.organizations (name, slug)
    VALUES (trim(p_name), p_slug)
    RETURNING id INTO v_org_id;

    INSERT INTO public.users (
        organization_id,
        role_id,
        full_name,
        email,
        password_hash
    )
    VALUES (
        v_org_id,
        v_owner_role_id,
        trim(p_owner_name),
        lower(trim(p_email)),
        p_password_hash
    )
    RETURNING id INTO v_owner_id;

    organization_id := v_org_id;
    owner_id := v_owner_id;

    RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.register_organization(
    TEXT, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.register_organization(
    TEXT, TEXT, TEXT, TEXT, TEXT
) TO tenantflow_app;
