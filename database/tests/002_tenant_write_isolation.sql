
-- TenantFlow - Tenant Write Isolation Tests
-- File: database/tests/002_tenant_write_isolation.sql
--
-- Run against the LOCAL DEVELOPMENT database only.
-- Requires demo Alpha and Beta tenant data.
--
-- All test writes are rolled back.
-- Tests run as the restricted tenantflow_app role.

\set ON_ERROR_STOP on

BEGIN;

-- --------------------------------------------------
-- 1. Verify the demo tenants and data exist.
-- --------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.organizations
        WHERE id = '11111111-1111-4111-8111-111111111111'
    ) THEN
        RAISE EXCEPTION 'Alpha demo tenant is missing';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.organizations
        WHERE id = '22222222-2222-4222-8222-222222222222'
    ) THEN
        RAISE EXCEPTION 'Beta demo tenant is missing';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.users
        WHERE organization_id =
              '11111111-1111-4111-8111-111111111111'
    ) THEN
        RAISE EXCEPTION 'Alpha demo user is missing';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.bookings
        WHERE organization_id =
              '22222222-2222-4222-8222-222222222222'
    ) THEN
        RAISE EXCEPTION 'Beta demo booking is missing';
    END IF;
END;
$$;

-- Use the application's restricted role.
SET LOCAL ROLE tenantflow_app;

-- --------------------------------------------------
-- 2. Set tenant context to Alpha.
-- --------------------------------------------------

SELECT set_config(
    'app.tenant_id',
    '11111111-1111-4111-8111-111111111111',
    true
);

DO $$
DECLARE
    v_alpha_user UUID;
    v_booking_id UUID;
    v_count INTEGER;
    v_affected INTEGER;
    v_blocked BOOLEAN;
BEGIN
    SELECT id INTO v_alpha_user
    FROM public.users
    WHERE organization_id =
          '11111111-1111-4111-8111-111111111111'
    LIMIT 1;

    -- Test 1: Alpha cannot read Beta bookings.
    SELECT COUNT(*) INTO v_count
    FROM public.bookings
    WHERE organization_id =
          '22222222-2222-4222-8222-222222222222';

    IF v_count <> 0 THEN
        RAISE EXCEPTION 'FAIL: Cross-tenant SELECT';
    END IF;

    RAISE NOTICE 'PASS 1: Cross-tenant SELECT blocked';

    -- Test 2: Alpha can create its own booking.
    INSERT INTO public.bookings (
        organization_id,
        created_by,
        title,
        start_time,
        end_time,
        status
    )
    VALUES (
        '11111111-1111-4111-8111-111111111111',
        v_alpha_user,
        'Tenant Isolation Test Booking',
        NOW() + INTERVAL '2 days',
        NOW() + INTERVAL '2 days 1 hour',
        'PENDING'
    )
    RETURNING id INTO v_booking_id;

    IF v_booking_id IS NULL THEN
        RAISE EXCEPTION 'FAIL: Own-tenant INSERT';
    END IF;

    RAISE NOTICE 'PASS 2: Own-tenant INSERT allowed';

    -- Test 3: Alpha cannot insert a Beta booking.
    v_blocked := FALSE;

    BEGIN
        INSERT INTO public.bookings (
            organization_id,
            created_by,
            title,
            start_time,
            end_time,
            status
        )
        VALUES (
            '22222222-2222-4222-8222-222222222222',
            v_alpha_user,
            'Unauthorized Beta Booking',
            NOW() + INTERVAL '3 days',
            NOW() + INTERVAL '3 days 1 hour',
            'PENDING'
        );

    EXCEPTION
        WHEN insufficient_privilege THEN
            v_blocked := TRUE;
    END;

    IF NOT v_blocked THEN
        RAISE EXCEPTION 'FAIL: Cross-tenant INSERT';
    END IF;

    RAISE NOTICE 'PASS 3: Cross-tenant INSERT blocked';

    -- Test 4: Alpha can update its own booking.
    UPDATE public.bookings
    SET title = 'Updated Alpha Test Booking'
    WHERE id = v_booking_id
      AND organization_id =
          '11111111-1111-4111-8111-111111111111';

    GET DIAGNOSTICS v_affected = ROW_COUNT;

    IF v_affected <> 1 THEN
        RAISE EXCEPTION 'FAIL: Own-tenant UPDATE';
    END IF;

    RAISE NOTICE 'PASS 4: Own-tenant UPDATE allowed';

    -- Test 5: Alpha cannot update Beta bookings.
    UPDATE public.bookings
    SET title = 'Unauthorized Cross-Tenant Update'
    WHERE organization_id =
          '22222222-2222-4222-8222-222222222222';

    GET DIAGNOSTICS v_affected = ROW_COUNT;

    IF v_affected <> 0 THEN
        RAISE EXCEPTION 'FAIL: Cross-tenant UPDATE';
    END IF;

    RAISE NOTICE 'PASS 5: Cross-tenant UPDATE blocked';

    -- Test 6: Alpha cannot delete Beta bookings.
    DELETE FROM public.bookings
    WHERE organization_id =
          '22222222-2222-4222-8222-222222222222';

    GET DIAGNOSTICS v_affected = ROW_COUNT;

    IF v_affected <> 0 THEN
        RAISE EXCEPTION 'FAIL: Cross-tenant DELETE';
    END IF;

    RAISE NOTICE 'PASS 6: Cross-tenant DELETE blocked';

    -- Test 7: Alpha cannot update Beta users.
    UPDATE public.users
    SET full_name = 'Unauthorized User Update'
    WHERE organization_id =
          '22222222-2222-4222-8222-222222222222';

    GET DIAGNOSTICS v_affected = ROW_COUNT;

    IF v_affected <> 0 THEN
        RAISE EXCEPTION 'FAIL: Cross-tenant user UPDATE';
    END IF;

    RAISE NOTICE 'PASS 7: Cross-tenant user UPDATE blocked';

    -- Test 8: Alpha cannot delete Beta users.
    DELETE FROM public.users
    WHERE organization_id =
          '22222222-2222-4222-8222-222222222222';

    GET DIAGNOSTICS v_affected = ROW_COUNT;

    IF v_affected <> 0 THEN
        RAISE EXCEPTION 'FAIL: Cross-tenant user DELETE';
    END IF;

    RAISE NOTICE 'PASS 8: Cross-tenant user DELETE blocked';

    -- Test 9: Alpha can delete its own test booking.
    DELETE FROM public.bookings
    WHERE id = v_booking_id;

    GET DIAGNOSTICS v_affected = ROW_COUNT;

    IF v_affected <> 1 THEN
        RAISE EXCEPTION 'FAIL: Own-tenant DELETE';
    END IF;

    RAISE NOTICE 'PASS 9: Own-tenant DELETE allowed';
END;
$$;

-- --------------------------------------------------
-- 3. Check missing tenant context.
-- --------------------------------------------------

SELECT set_config('app.tenant_id', '', true);

DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM public.bookings;

    IF v_count <> 0 THEN
        RAISE EXCEPTION
            'FAIL: No-context booking visibility';
    END IF;

    SELECT COUNT(*) INTO v_count
    FROM public.users;

    IF v_count <> 0 THEN
        RAISE EXCEPTION
            'FAIL: No-context user visibility';
    END IF;

    RAISE NOTICE 'PASS 10: No tenant context returns no rows';
END;
$$;

-- --------------------------------------------------
-- 4. Confirm Beta can see only Beta bookings.
-- --------------------------------------------------

SELECT set_config(
    'app.tenant_id',
    '22222222-2222-4222-8222-222222222222',
    true
);

DO $$
DECLARE
    v_beta_count INTEGER;
    v_alpha_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_beta_count
    FROM public.bookings
    WHERE organization_id =
          '22222222-2222-4222-8222-222222222222';

    SELECT COUNT(*) INTO v_alpha_count
    FROM public.bookings
    WHERE organization_id =
          '11111111-1111-4111-8111-111111111111';

    IF v_beta_count < 1 OR v_alpha_count <> 0 THEN
        RAISE EXCEPTION
            'FAIL: Beta tenant booking visibility';
    END IF;

    RAISE NOTICE 'PASS 11: Beta sees only Beta bookings';
END;
$$;

-- Undo every change made during testing.
ROLLBACK;
