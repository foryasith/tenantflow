
-- Test tenant isolation using restricted DB role

BEGIN;

SELECT set_config(
    'app.tenant_id',
    '11111111-1111-4111-8111-111111111111',
    true
);

SELECT 'Alpha tenant' AS test_name;

SELECT title FROM bookings ORDER BY title;

COMMIT;

BEGIN;

SELECT set_config(
    'app.tenant_id',
    '22222222-2222-4222-8222-222222222222',
    true
);

SELECT 'Beta tenant' AS test_name;

SELECT title FROM bookings ORDER BY title;

COMMIT;

BEGIN;

SELECT set_config('app.tenant_id', '', true);

SELECT 'No tenant context' AS test_name;

SELECT COUNT(*) AS visible_bookings FROM bookings;

COMMIT;
