# TenantFlow – Multi-Tenant SaaS Booking Platform

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-Type_Safe-blue?logo=typescript)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss)
![Docker](https://img.shields.io/badge/Docker-Enabled-2496ED?logo=docker)
![Status](https://img.shields.io/badge/Week_1-Security_Review_In_Progress-orange)

**Parallax Labs | Full-Stack Developer Internship | Week 1**

TenantFlow is a full-stack multi-tenant SaaS booking platform built with Next.js, TypeScript, PostgreSQL, and Docker. Organizations share one application and database while tenant-aware access controls help isolate their data.

**Current status:** Week 1 features and database read/write isolation tests have been implemented. Final dependency and privileged-database-function security reviews remain outstanding. The project is **not production-ready**.

---

## 1. Project Overview

TenantFlow provides the foundation for a booking platform in which each organization has a workspace, users, roles, and bookings.

### Implemented Week 1 capabilities

- Organization and owner registration with Zod validation and bcrypt password hashing
- Multi-tenant PostgreSQL schema with organizations, roles, users, and bookings
- PostgreSQL Row-Level Security (RLS) and transaction-scoped tenant context
- Database-backed login sessions using HTTP-only cookies
- Login, logout, and protected organization dashboard
- Email-based password recovery via Resend
- Single-use reset tokens with 15-minute expiration and session revocation
- Persistent PostgreSQL-backed authentication request throttling
- Authentication session integrity validation (Migration 010)
- Tenant read-isolation and 11 tenant write-isolation test scenarios
- Docker Compose local database and health-check endpoint

Booking creation APIs, calendar UI, payments, real-time collaboration, and caching are planned for later weeks.

---

## 2. Technology Stack

| Category | Technology |
|---|---|
| Frontend | Next.js 16, React, TypeScript |
| Styling | Tailwind CSS 4 |
| Backend | Next.js App Router API routes |
| Database | PostgreSQL 16, node-postgres (`pg`) |
| Containerization | Docker and Docker Compose |
| Validation | Zod |
| Password hashing | bcryptjs (cost factor 12) |
| Authentication | Database-backed sessions and HTTP-only cookies |
| Password recovery email | Resend |
| Rate limiting | PostgreSQL and HMAC-SHA256 |
| Version control | Git and GitHub |

---

## 3. System Architecture

```mermaid
flowchart TD
    A[Browser] --> B[Next.js Application]
    B --> C[React UI]
    B --> D[API Routes]
    D --> E[Zod Validation]
    E --> F[Authentication and Security Layer]
    F --> G[Session Management]
    F --> H[Rate Limiting]
    F --> I[Password Recovery]
    G --> J[(PostgreSQL)]
    H --> J
    I --> J
    I --> K[Resend Email API]
    J --> L[Row-Level Security]
    L --> M[Tenant-Scoped Data]
```

**Design principles:** One shared application and database, explicit server-side session validation, tenant-scoped queries, database constraints, and layered input validation. A separate application database role is used for normal database connections.

---

## 4. Database Design

| Table | Purpose |
|---|---|
| `organizations` | Workspaces, names, and unique slugs |
| `roles` | OWNER, ADMIN, and MEMBER roles |
| `users` | Organization users and password hashes |
| `bookings` | Organization-owned bookings and schedules |
| `auth_sessions` | Hashed session tokens and expiration |
| `password_reset_tokens` | Time-limited password recovery tokens |
| `auth_rate_limits` | Persistent request counters identified by HMAC keys |

### Entity Relationship Diagram

```mermaid
erDiagram
    ORGANIZATIONS ||--o{ USERS : has
    ORGANIZATIONS ||--o{ BOOKINGS : owns
    ORGANIZATIONS ||--o{ AUTH_SESSIONS : scopes
    ROLES ||--o{ USERS : assigned
    USERS ||--o{ BOOKINGS : creates
    USERS ||--o{ AUTH_SESSIONS : authenticates
    USERS ||--o{ PASSWORD_RESET_TOKENS : requests

    ORGANIZATIONS {
        uuid id PK
        varchar name
        varchar slug UK
        timestamptz created_at
    }
    ROLES {
        uuid id PK
        varchar name UK
    }
    USERS {
        uuid id PK
        uuid organization_id FK
        uuid role_id FK
        varchar full_name
        varchar email
        text password_hash
    }
    BOOKINGS {
        uuid id PK
        uuid organization_id FK
        uuid created_by FK
        varchar title
        timestamptz start_time
        timestamptz end_time
        varchar status
    }
    AUTH_SESSIONS {
        uuid id PK
        uuid user_id FK
        uuid organization_id FK
        text token_hash UK
        timestamptz expires_at
    }
    PASSWORD_RESET_TOKENS {
        uuid id PK
        uuid user_id FK
        text token_hash
        timestamptz expires_at
        timestamptz used_at
    }
    AUTH_RATE_LIMITS {
        text rate_key PK
        int attempt_count
        timestamptz window_expires_at
        timestamptz updated_at
    }
```

The `auth_rate_limits` table stores pseudonymous keyed counters and does not require a direct user or organization foreign key.

---

## 5. Multi-Tenant Security

PostgreSQL RLS policies restrict organization and user records and booking operations using a transaction-scoped tenant identifier:

```sql
SELECT set_config('app.tenant_id', $1, true);
```

The application must derive the tenant identifier from a validated session; clients must not be allowed to select arbitrary tenant context.

- RLS and `FORCE ROW LEVEL SECURITY` are enabled for the protected tables.
- `organizations` has tenant-scoped read access through an RLS policy.
- `users` and `bookings` have tenant-scoped `SELECT`, `INSERT`, `UPDATE`, and `DELETE` policies.
- The composite foreign key on bookings requires the creator to belong to the booking's organization.
- A composite foreign key on sessions requires the session's user to belong to the same organization.
- The application database role, `tenantflow_app`, is not a superuser and has no `BYPASSRLS` attribute.

**Important security boundary:** The existing RLS design trusts `app.tenant_id`, a PostgreSQL setting that a holder of the application DB credentials can manipulate. Consequently, the tests demonstrate correct policy behavior under a trusted tenant context, **not** isolation against compromised database credentials or arbitrary SQL execution. Security-definer authentication functions also require a further privilege-boundary review.

---

## 6. Authentication and Session Security

### Organization registration

1. Validate organization name, full name, email, and password with Zod.
2. Create a unique organization slug.
3. Hash the password using bcrypt.
4. Create the organization and owner account using a database function.
5. Return organization and owner details.

### Login and session management

Users log in with workspace slug, email address, and password. The server verifies credentials, creates a cryptographically random session token, hashes the token for database storage, and sets an HTTP-only cookie.

- HTTP-only session cookie with `SameSite=Lax`
- Secure cookie flag in production mode
- Database-backed session expiry (seven days in the application)
- Session lookup and logout/revocation
- Dashboard access based on server-validated sessions

### Migration 010 – Session Integrity

`010_auth_session_integrity.sql` strengthens the session functions:

- Rejects session token hashes that are not 64 lowercase hexadecimal characters.
- Rejects expired session timestamps and session lifetimes exceeding seven days plus a small clock tolerance.
- Validates the requested user and organization association when creating sessions.
- Requires matching user and session organizations when retrieving sessions.
- Preserves existing function signatures and application execution privileges.

**Verified negative tests:** Invalid hash, expired session, excessive expiration, and nonexistent user/tenant identity were all rejected. A full post-migration browser login/dashboard/refresh/logout regression was requested but has not been separately confirmed in the provided test output.

These checks protect data integrity but **do not** prevent arbitrary session creation if the database role authorized to execute `create_auth_session` is compromised. That requires stronger privilege separation.

---

## 7. Password Recovery

Resend delivers email-based password recovery links. The server stores a SHA-256 hash of a random reset token rather than the plaintext token.

```mermaid
sequenceDiagram
    participant U as User
    participant UI as Frontend
    participant API as Auth API
    participant DB as PostgreSQL
    participant E as Resend
    U->>UI: Enter workspace slug and email
    UI->>API: POST /api/auth/forgot-password
    API->>DB: Check request limit
    API->>DB: Issue hashed reset token
    API->>E: Send reset email
    E-->>U: Deliver reset link
    U->>UI: Open link and set new password
    UI->>API: POST /api/auth/reset-password
    API->>DB: Consume token and update password
    API->>DB: Revoke previous sessions
    API-->>UI: Password updated
```

Recovery security features include 15-minute expiry, single-use tokens, bcrypt password rehashing, existing-session revocation, and generic responses intended to reduce account enumeration.

**Previously verified end-to-end behavior:** Reset email received; reset link worked; new password accepted; old password rejected; used token rejected (`400`); previous session rejected (`401`). Timing-based account enumeration protection and complete delivery-failure handling are not independently verified.

---

## 8. Authentication Rate Limiting

The application uses a PostgreSQL-backed counter and HMAC-SHA256 identifiers derived from normalized request inputs.

| Endpoint | Limit | Window | Status |
|---|---:|---|---|
| Login | 5 requests | 15 minutes | HTTP integration verified |
| Forgot Password | 3 requests | 15 minutes | Integrated; full delivery-blocking test not confirmed |
| Registration | 3 requests per email | 60 minutes | SQL rate-limit function test passed; full HTTP integration test not confirmed |

### Verified login HTTP test

```text
Attempt 1: HTTP 401
Attempt 2: HTTP 401
Attempt 3: HTTP 401
Attempt 4: HTTP 401
Attempt 5: HTTP 401
Attempt 6: HTTP 429
Attempt 7: HTTP 429
```

**Limitations:** Identity-based limits can be bypassed by changing email addresses; legitimate users can be rate-limited by repeated successful logins; the implementation does not include trusted-IP/network throttling or bot protection. Fixed `Retry-After` headers are not necessarily the exact remaining wait time. These controls are not sufficient on their own for internet-facing production use.

---

## 9. Database Migrations

| Migration | Purpose |
|---|---|
| `001_initial_schema.sql` | Organizations, roles, users, and bookings |
| `002_tenant_rls.sql` | Tenant role and Row-Level Security policies |
| `003_auth_sessions.sql` | Authentication session table and constraints |
| `004_organization_provisioning.sql` | Organization registration function |
| `005_auth_functions.sql` | Login and session functions |
| `006_revoke_auth_session.sql` | Logout/session revocation |
| `007_password_reset_tokens.sql` | Password recovery token storage |
| `008_password_reset_functions.sql` | Password recovery functions |
| `009_auth_rate_limiting.sql` | Persistent rate-limit counters and function |
| `010_auth_session_integrity.sql` | Session token, expiry, and tenant integrity validation |

Apply migrations **in numerical order** to a freshly initialized local development database. Do not replay the entire migration set on an already migrated database. Migration 010 has been applied and its negative tests passed in the development environment.

---

## 10. Local Development Setup

### Prerequisites

- Node.js and npm
- Docker Desktop
- Git
- Windows PowerShell for the commands below

### Step 1: Clone and install

```powershell
git clone https://github.com/foryasith/tenantflow.git
cd tenantflow
npm install
```

If setting up from `main` before the Week 1 branch has been merged, switch to the in-progress branch:

```powershell
git switch week/01-foundation
```

### Step 2: Start PostgreSQL

```powershell
docker compose up -d
docker exec tenantflow-db pg_isready -U postgres -d tenantflow
```

### Step 3: Configure environment variables

Create `.env.local` in the project root. Check `.env.example` and the application source for any additional required variables. Use the following placeholders only as examples:

```env
DATABASE_URL=postgresql://tenantflow_app:YOUR_LOCAL_PASSWORD@127.0.0.1:5433/tenantflow
RESEND_API_KEY=YOUR_RESEND_API_KEY
EMAIL_FROM=YOUR_VERIFIED_SENDER
APP_URL=http://localhost:3000
AUTH_RATE_LIMIT_SECRET=YOUR_RANDOM_SECRET
```

Generate a new secret:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Never commit `.env.local`, actual passwords, secret tokens, or email API keys.

### Step 4: Apply migrations (fresh local database only)

```powershell
Get-ChildItem database/migrations -Filter '*.sql' |
  Sort-Object Name |
  ForEach-Object {
    $file = $_
    Write-Host "Applying $($file.Name)"
    docker cp $file.FullName tenantflow-db:/tmp/migration.sql
    if ($LASTEXITCODE -ne 0) { throw "Copy failed: $($file.Name)" }
    docker exec tenantflow-db psql -X -v ON_ERROR_STOP=1 -1 -U postgres -d tenantflow -f /tmp/migration.sql
    if ($LASTEXITCODE -ne 0) { throw "Migration failed: $($file.Name)" }
  }
```

**Caution:** These migrations were developed incrementally; review the initial Docker/database role setup before using the bootstrap commands on a different machine. `-1` wraps each migration execution in a transaction where supported.

### Step 5: Seed demonstration data (fresh database only)

```powershell
docker cp database/seeds/001_demo_data.sql tenantflow-db:/tmp/seed.sql
docker exec tenantflow-db psql -X -v ON_ERROR_STOP=1 -U postgres -d tenantflow -f /tmp/seed.sql
```

### Step 6: Start the app

```powershell
npm run dev
```

Open `http://localhost:3000/login`.

### Step 7: Production build

```powershell
npm run build
```

---

## 11. Application Routes

### Frontend

| Route | Purpose |
|---|---|
| `/` | Landing page |
| `/register` | Create organization and owner |
| `/login` | Authenticate into a workspace |
| `/dashboard` | Protected workspace dashboard |
| `/forgot-password` | Request password recovery email |
| `/reset-password` | Enter a new password using reset token |

### API

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Database health |
| POST | `/api/auth/register` | Organization registration |
| POST | `/api/auth/login` | Authentication and session creation |
| POST | `/api/auth/logout` | Revoke session |
| GET | `/api/auth/me` | Current authenticated user |
| POST | `/api/auth/forgot-password` | Issue password recovery email |
| POST | `/api/auth/reset-password` | Consume reset token and update password |

---

## 12. Testing and Quality Assurance

### TypeScript, ESLint, and build

```powershell
npx tsc --noEmit
npx eslint .
npm run build
```

These checks passed following Migration 010 and the authentication changes.

### Health and database checks

```powershell
Invoke-RestMethod http://localhost:3000/api/health
docker exec tenantflow-db psql -U postgres -d tenantflow -c "\dt"
```

### Tenant read isolation

`database/tests/001_tenant_isolation.sql` exercises Alpha, Beta, and missing-tenant read contexts. Earlier development tests confirmed tenant-specific read visibility.

### Tenant write isolation — 11/11 passed

`database/tests/002_tenant_write_isolation.sql` validates RLS using the restricted `tenantflow_app` role. It executes inside a transaction that ends with `ROLLBACK`.

| # | Scenario | Result |
|---:|---|---|
| 1 | Cross-tenant booking SELECT blocked | PASS |
| 2 | Same-tenant booking INSERT allowed | PASS |
| 3 | Cross-tenant booking INSERT blocked | PASS |
| 4 | Same-tenant booking UPDATE allowed | PASS |
| 5 | Cross-tenant booking UPDATE blocked | PASS |
| 6 | Cross-tenant booking DELETE blocked | PASS |
| 7 | Cross-tenant user UPDATE blocked | PASS |
| 8 | Cross-tenant user DELETE blocked | PASS |
| 9 | Same-tenant test booking DELETE allowed | PASS |
| 10 | Missing tenant context exposes no users/bookings | PASS |
| 11 | Beta tenant sees only Beta bookings | PASS |

Run against the **seeded local development database only**:

```powershell
docker cp database/tests/002_tenant_write_isolation.sql tenantflow-db:/tmp/002_tenant_write_isolation.sql
docker exec tenantflow-db psql -X -v ON_ERROR_STOP=1 -U postgres -d tenantflow -f /tmp/002_tenant_write_isolation.sql
```

Expected ending: `PASS 11: Beta sees only Beta bookings`, followed by `ROLLBACK`.

These tests verify enforcement of the specified policies under selected tenant contexts; they do not prove security against arbitrary database access.

### Session integrity tests — 4/4 passed

- Invalid session token hash rejected.
- Expired session rejected.
- Excessively long session expiration rejected.
- Unknown user/organization identity rejected.

### Additional authentication tests

- Registration, login, logout, session verification, and protected dashboard exercised during development.
- Password recovery email, single-use tokens, new-password login, and previous-session revocation verified.
- Login rate limiting verified by HTTP 429 after the fifth request.

**Still to verify separately:** Post-Migration-010 browser session regression, comprehensive registration/forgot-password HTTP abuse tests, and dependency vulnerability review.

---

## 13. Project Structure

```text
tenantflow/
├── database/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_tenant_rls.sql
│   │   ├── 003_auth_sessions.sql
│   │   ├── 004_organization_provisioning.sql
│   │   ├── 005_auth_functions.sql
│   │   ├── 006_revoke_auth_session.sql
│   │   ├── 007_password_reset_tokens.sql
│   │   ├── 008_password_reset_functions.sql
│   │   ├── 009_auth_rate_limiting.sql
│   │   └── 010_auth_session_integrity.sql
│   ├── seeds/
│   │   └── 001_demo_data.sql
│   └── tests/
│       ├── 001_tenant_isolation.sql
│       └── 002_tenant_write_isolation.sql
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── register/
│   │   │   │   ├── login/
│   │   │   │   ├── logout/
│   │   │   │   ├── me/
│   │   │   │   ├── forgot-password/
│   │   │   │   └── reset-password/
│   │   │   └── health/
│   │   ├── dashboard/
│   │   ├── login/
│   │   ├── register/
│   │   ├── forgot-password/
│   │   └── reset-password/
│   ├── components/
│   └── lib/
│       ├── auth.ts
│       ├── db.ts
│       ├── email.ts
│       ├── rate-limit.ts
│       └── validations/
├── public/
├── .env.example
├── next.config.ts
├── postcss.config.mjs
├── package.json
└── README.md
```

---

## 14. Known Limitations and Security Work Remaining

### High-priority security review

- **Database trust boundary:** `tenantflow_app` can call elevated `SECURITY DEFINER` authentication functions. The ability to supply arguments to `create_auth_session` and password reset functions remains sensitive if DB credentials are exposed.
- **Tenant context:** The application database role can set `app.tenant_id`; RLS tests assume the supplied tenant context is trustworthy.
- **Dependency audit:** `npm audit --omit=dev`, `npm audit`, and `npm outdated` results have not yet been reviewed.
- **Authentication abuse:** Registration needs trusted-IP/network protections, bot mitigation, and broader HTTP integration tests. Forgot-password email throttling should be verified end-to-end.
- **Account enumeration:** Uniform messages alone do not fully prevent timing or side-channel leakage.
- **Session regression:** Explicit browser verification after Migration 010 remains pending.

### Upcoming functionality

- Booking management and calendar UI — Week 2
- Payments and pricing — Week 3
- Real-time capabilities — Week 4
- Caching and settings — Week 5
- Deployment and polish — Week 6

This repository has not undergone a full production security assessment.

---

## 15. Six-Week Internship Roadmap

| Week | Focus |
|---|---|
| 1 | Architecture, schema, tenant isolation, authentication, and security |
| 2 | Booking APIs and calendar UI |
| 3 | Payments, webhooks, and pricing |
| 4 | Real-time collaboration |
| 5 | Caching and application settings |
| 6 | Deployment, documentation, and final polish |

---

## 16. Git Workflow

| Branch | Purpose |
|---|---|
| `main` | Stable submission branch |
| `week/01-foundation` | Week 1 development and hardening |
| Future weekly branches | Upcoming features |

Workflow: develop on the weekly branch, test, commit, push, review, and merge into `main` only after checks pass.

Selected commits from Week 1:

```text
feat(security): rate limit password recovery requests
feat(security): protect login with persistent rate limiting
fix(security): validate authentication session integrity
test(security): verify tenant write isolation policies
```

---

## 17. Project Status

**Week 1: Foundation built; final security review in progress.**

Implemented: multi-tenant PostgreSQL schema, RLS, registration, session-based login, password recovery, persistent rate-limit integration, session integrity hardening, and 11 successful tenant write-isolation tests.

Pending: dependency audit, elevated function/credential security design, remaining HTTP security verification, post-migration browser regression, and Week 1 final review/merge.

**Repository:** https://github.com/foryasith/tenantflow

**Internship:** Parallax Labs – Full-Stack Developer Internship
