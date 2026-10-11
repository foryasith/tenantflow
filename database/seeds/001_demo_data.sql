
-- TenantFlow Demo Seed Data

INSERT INTO organizations (id, name, slug)
VALUES
(
 '11111111-1111-4111-8111-111111111111',
 'Alpha Studio',
 'alpha-studio'
),
(
 '22222222-2222-4222-8222-222222222222',
 'Beta Workspace',
 'beta-workspace'
);

INSERT INTO users (
    id,
    organization_id,
    role_id,
    full_name,
    email,
    password_hash
)
VALUES
(
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 '11111111-1111-4111-8111-111111111111',
 (SELECT id FROM roles WHERE name = 'OWNER'),
 'Alpha Owner',
 'owner@alpha.example',
 'DISABLED_DEMO_ACCOUNT'
),
(
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 '22222222-2222-4222-8222-222222222222',
 (SELECT id FROM roles WHERE name = 'OWNER'),
 'Beta Owner',
 'owner@beta.example',
 'DISABLED_DEMO_ACCOUNT'
);

INSERT INTO bookings (
    organization_id,
    created_by,
    title,
    start_time,
    end_time,
    status
)
VALUES
(
 '11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'Alpha Design Consultation',
 '2026-11-01 09:00:00+00',
 '2026-11-01 10:00:00+00',
 'CONFIRMED'
),
(
 '22222222-2222-4222-8222-222222222222',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 'Beta Team Meeting',
 '2026-11-02 11:00:00+00',
 '2026-11-02 12:00:00+00',
 'PENDING'
);
