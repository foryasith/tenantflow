# TenantFlow – Multi-Tenant SaaS Booking Platform

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-Type_Safe-blue?logo=typescript)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss)
![Docker](https://img.shields.io/badge/Docker-Enabled-2496ED?logo=docker)
![Status](https://img.shields.io/badge/Week_1-Final_Security_Review-orange)

**Parallax Labs | Full-Stack Developer Internship | Week 1**

TenantFlow is a full-stack, multi-tenant SaaS booking platform built with Next.js, TypeScript, PostgreSQL, and Docker. Organizations share one application and database while tenant-aware access controls help isolate their data.

**Current status:** Week 1 foundation and tenant read/write-isolation testing have been implemented. Dependency findings have been reviewed, with an outstanding development-tooling advisory. Privileged database function and deployment security reviews remain open. **The application is not production-ready.**

---

## 1. Project Overview

TenantFlow provides the foundation for a SaaS booking platform where each organization has its own workspace, users, roles, and bookings.

### Implemented Week 1 capabilities

- Organization and owner registration with Zod validation and bcrypt password hashing
- Multi-tenant PostgreSQL schema with organizations, roles, users, and bookings
- PostgreSQL Row-Level Security (RLS) and transaction-scoped tenant context
- Database-backed login sessions with HTTP-only cookies
- Login, logout, and protected organization dashboard
- Email-based password recovery via Resend
- Single-use reset tokens with 15-minute expiry and session revocation
- Persistent PostgreSQL-backed login, password-recovery, and registration rate-limiting integration
- Session integrity checks through Migration 010
- Tenant read-isolation and 11 tenant write-isolation test scenarios
- Docker Compose development database and database health-check endpoint

Booking APIs, calendar UI, payments, real-time collaboration, and caching are scheduled for later weeks.

---

## 2. Technology Stack

| Category | Technology |
|---|---|
| Frontend | Next.js 16.4.0, React, TypeScript |
| Styling | Tailwind CSS 4 |
| Backend | Next.js App Router API routes |
| Database | PostgreSQL 16, node-postgres (`pg`) |
| Containerization | Docker and Docker Compose |
| Validation | Zod 4.6.7 |
| Password hashing | bcryptjs (cost factor 12) |
| Authentication | Database-backed sessions, HTTP-only cookies |
| Password recovery email | Resend |
| Rate limiting | PostgreSQL, HMAC-SHA256 |
| Linting | ESLint 9, eslint-config-next 16.4.0 |
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

**Design principles:** Shared application/database, server-side session checks, tenant-aware queries, SQL constraints, input validation, and a non-superuser application database role.

---

## 4. Database Design

| Table | Purpose |
|---|---|
| `organizations` | Organization workspaces and unique slugs |
| `roles` | OWNER, ADMIN, MEMBER roles |
| `users` | Organization users and password hashes |
| `bookings` | Tenant-owned booking records |
| `auth_sessions` | Hashed session tokens and expiration |
| `password_reset_tokens` | Time-limited password-recovery tokens |
| `auth_rate_limits` | HMAC-keyed persistent request counters |

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

The `auth_rate_limits` table stores keyed counters without a direct user or organization foreign key. For precise database column definitions, refer to the SQL migration files.

---

## 5. Multi-Tenant Security

The application uses PostgreSQL RLS policies based on a transaction-scoped tenant identifier:

```sql
SELECT set_config('app.tenant_id', $1, true);
```

The application must derive the tenant ID from a verified session, rather than from arbitrary client input.

- RLS and `FORCE ROW LEVEL SECURITY` are enabled for protected tables.
- `organizations` has tenant-scoped SELECT access for `tenantflow_app`.
- `users` and `bookings` have tenant-scoped policies for SELECT, INSERT, UPDATE, and DELETE.
- Composite foreign keys enforce booking creator/organization integrity and session user/organization integrity.
- `tenantflow_app` is not a superuser and does not have `BYPASSRLS`.

**Security boundary:** `tenantflow_app` can set `app.tenant_id`. The isolation tests establish policy behavior for the selected tenant context; they do **not** establish isolation after application database credentials are compromised or arbitrary SQL execution is obtained. Elevated `SECURITY DEFINER` authentication functions require separate privilege-boundary hardening.

---

## 6. Authentication and Session Security

### Organization registration

1. Validate organization and owner details with Zod.
2. Generate a unique organization slug.
3. Hash the password using bcrypt.
4. Create the organization and owner through the registration database function.
5. Return organization and owner details.

### Login and session management

Users authenticate with workspace slug, email, and password. The backend generates a random session token, stores its hash, and sets an HTTP-only cookie.

- HTTP-only cookie with `SameSite=Lax`
- `Secure` flag enabled in production mode
- Seven-day application session duration
- Database-backed session validation, logout, and revocation
- Protected dashboard based on a server-validated session

### Migration 010 – Session Integrity

`010_auth_session_integrity.sql` strengthens authentication functions by:

- Rejecting hashes that are not exactly 64 lowercase hexadecimal characters
- Rejecting expired sessions and expiration dates beyond seven days plus clock tolerance
- Validating user-to-organization membership before session creation
- Requiring matching session/user organization IDs during session lookup
- Preserving function signatures required by the existing application

**Verified negative tests:** Invalid token hash, expired session, 30-day session expiry, and nonexistent user/tenant identity were all rejected (4/4).

**Outstanding:** A fresh browser login → dashboard → refresh → logout regression after Migration 010 has not been explicitly confirmed. Input validation alone does not prevent misuse of `create_auth_session` by a compromised privileged database role.

---

## 7. Password Recovery

Resend delivers recovery emails. The backend stores SHA-256 hashes of cryptographically random recovery tokens instead of plaintext tokens.

```mermaid
sequenceDiagram
    participant U as User
    participant UI as Frontend
    participant API as Auth API
    participant DB as PostgreSQL
    participant E as Resend
    U->>UI: Enter workspace slug and email
    UI->>API: POST /api/auth/forgot-password
    API->>DB: Check rate limit
    API->>DB: Issue hashed reset token
    API->>E: Request email delivery
    E-->>U: Recovery link
    U->>UI: Open link and enter new password
    UI->>API: POST /api/auth/reset-password
    API->>DB: Consume token, update password
    API->>DB: Revoke previous sessions
    API-->>UI: Password updated
```

Security measures include a 15-minute token lifetime, single-use enforcement, bcrypt password rehashing, session revocation, and generic recovery responses.

**Previously verified:** Email delivered, link opened, new password worked, old password failed, reused token returned HTTP 400, and prior session returned HTTP 401. Full timing-side-channel and delivery-failure behavior has not been independently verified.

---

## 8. Authentication Rate Limiting

A shared server-side helper uses HMAC-SHA256 identifiers and persistent PostgreSQL counters.

| Endpoint | Limit | Window | Verification |
|---|---:|---|---|
| Login | 5 requests | 15 minutes | HTTP test passed |
| Forgot Password | 3 requests | 15 minutes | Implemented; end-to-end email blocking not conclusively verified |
| Registration | 3 requests per email | 60 minutes | SQL limiter test reported passed; complete HTTP integration test not confirmed |

### Login rate-limit result

```text
Attempt 1: HTTP 401
Attempt 2: HTTP 401
Attempt 3: HTTP 401
Attempt 4: HTTP 401
Attempt 5: HTTP 401
Attempt 6: HTTP 429
Attempt 7: HTTP 429
```

**Limitations:** Identity-based limits can be bypassed by rotating emails; legitimate accounts may be rate-limited after successful logins; trusted IP/network throttling and bot controls are not implemented. Fixed `Retry-After` values may not match the exact remaining wait period.

---

## 9. Database Migrations

| Migration | Purpose |
|---|---|
| `001_initial_schema.sql` | Organizations, roles, users, bookings |
| `002_tenant_rls.sql` | Tenant role and RLS policies |
| `003_auth_sessions.sql` | Session storage and integrity constraints |
| `004_organization_provisioning.sql` | Organization/owner registration function |
| `005_auth_functions.sql` | Login and session database functions |
| `006_revoke_auth_session.sql` | Session revocation |
| `007_password_reset_tokens.sql` | Reset-token storage |
| `008_password_reset_functions.sql` | Password-reset operations |
| `009_auth_rate_limiting.sql` | Persistent rate-limit storage/function |
| `010_auth_session_integrity.sql` | Token, expiry, and membership checks |

Apply migration files **in numerical order** on a newly initialized database. Do not replay all migrations on an existing database. Migration 010 was applied to the development database and its four negative tests passed.

---

## 10. Local Development Setup

### Prerequisites

- Node.js and npm
- Docker Desktop
- Git
- Windows PowerShell (commands below)

### Step 1: Clone and install

```powershell
git clone https://github.com/foryasith/tenantflow.git
cd tenantflow
git switch week/01-foundation
npm install
```

The branch-switch command is only needed while Week 1 changes have not been merged into `main`.

### Step 2: Start PostgreSQL

```powershell
docker compose up -d
docker exec tenantflow-db pg_isready -U postgres -d tenantflow
```

### Step 3: Environment variables

Create `.env.local` in the root directory and check `.env.example` for the current required variable names.

```env
DATABASE_URL=postgresql://tenantflow_app:YOUR_LOCAL_PASSWORD@127.0.0.1:5433/tenantflow
RESEND_API_KEY=YOUR_RESEND_API_KEY
EMAIL_FROM=YOUR_VERIFIED_SENDER
APP_URL=http://localhost:3000
AUTH_RATE_LIMIT_SECRET=YOUR_RANDOM_SECRET
```

Create a random secret:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

**Never commit** `.env.local`, database passwords, API keys, reset links, or session tokens.

### Step 4: Apply migrations (new local database only)

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

**Important:** This setup is intended for the existing Docker-based local development environment. Check Docker Compose provisioning, role creation, and migration prerequisites before setting up on a different machine. Never run the full migration sequence on your current already-migrated database.

### Step 5: Seed demo data (new local database only)

```powershell
docker cp database/seeds/001_demo_data.sql tenantflow-db:/tmp/seed.sql
docker exec tenantflow-db psql -X -v ON_ERROR_STOP=1 -U postgres -d tenantflow -f /tmp/seed.sql
```

### Step 6: Start app

```powershell
npm run dev
```

Visit `http://localhost:3000/login`.

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
| `/register` | Register organization/owner |
| `/login` | Workspace login |
| `/dashboard` | Protected dashboard |
| `/forgot-password` | Request recovery email |
| `/reset-password` | Create new password using recovery token |

### API

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | Database health |
| POST | `/api/auth/register` | Registration |
| POST | `/api/auth/login` | Authentication/session creation |
| POST | `/api/auth/logout` | Session revocation |
| GET | `/api/auth/me` | Current authenticated user |
| POST | `/api/auth/forgot-password` | Password recovery request |
| POST | `/api/auth/reset-password` | Reset password |

---

## 12. Testing and Quality Assurance

### TypeScript, ESLint, and production build

```powershell
npx tsc --noEmit
npx eslint .
npm run build
```

All three checks passed following the Zod 4.6.7 patch update and Migration 010.

### Dependency Security Audit (October 2026)

The dependency review uses `npm audit --omit=dev`, `npm audit`, `npm outdated`, and `npm ls`.

| Check | Observed result |
|---|---|
| `npm audit --omit=dev` | **0 reported production vulnerabilities** |
| `npm audit` | **5 high-severity findings** in development-tooling dependency chain |
| `npm outdated` | Minor Zod patch available and applied; major versions of other tooling available |
| `npx tsc --noEmit` | Passed after Zod update |
| `npx eslint .` | Passed after Zod update |
| `npm run build` | Passed after Zod update |

**Installed affected dependency chain:**

```text
eslint-config-next@16.4.0
└── @next/eslint-plugin-next@16.4.0
    └── fast-glob@3.3.1
        └── micromatch@4.0.8
            └── braces@3.0.3
```

The audit identifies advisory [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), described as stack-exhaustion denial of service through deeply nested patterns. The five reported findings arise along this dependency chain; they do not necessarily represent five unrelated root vulnerabilities.

**Upstream compatibility verification:** `npm view @next/eslint-plugin-next@16.4.0 dependencies --json` reports `fast-glob: "3.3.1"` and `@eslint-community/eslint-utils: "4.9.1"`. The plugin currently pins `fast-glob@3.3.1`; `npm view fast-glob version` reports `3.3.3` as the latest available version, but upgrading `fast-glob` alone has not been established as a fix for the advisory.

`npm audit fix --force` suggested installing `eslint-config-next@14.2.35`, an incompatible downgrade for this Next.js 16 project. **That force fix has not been applied.** The reported development-tooling issue remains open pending a compatible, verified remediation. Zero reported production vulnerabilities does not imply a full security assessment.

**Completed dependency maintenance:** Zod was upgraded from `4.6.6` to `4.6.7`, with TypeScript, ESLint, and production build passing afterward.

To recheck dependencies:

```powershell
npm audit --omit=dev
npm audit
npm ls braces micromatch fast-glob eslint-config-next @next/eslint-plugin-next
```

Avoid `npm audit fix --force` without a compatibility review and successful regression tests.

### Health and database checks

```powershell
Invoke-RestMethod http://localhost:3000/api/health
docker exec tenantflow-db psql -U postgres -d tenantflow -c "\dt"
```

### Tenant read isolation

`database/tests/001_tenant_isolation.sql` checks Alpha, Beta, and missing-tenant read contexts. Earlier development tests confirmed tenant-specific read visibility.

### Tenant write isolation — 11/11 passed

`database/tests/002_tenant_write_isolation.sql` executes as `tenantflow_app` in a transaction ending in `ROLLBACK`.

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
| 11 | Beta sees only Beta bookings | PASS |

Run on the **seeded local development database only**:

```powershell
docker cp database/tests/002_tenant_write_isolation.sql tenantflow-db:/tmp/002_tenant_write_isolation.sql
docker exec tenantflow-db psql -X -v ON_ERROR_STOP=1 -U postgres -d tenantflow -f /tmp/002_tenant_write_isolation.sql
```

Expected final test output includes `PASS 11: Beta sees only Beta bookings` and `ROLLBACK`.

**Scope limitation:** The tests validate specified RLS policies under a chosen tenant context; they do not prove safety against arbitrary database access.

### Session integrity — 4/4 negative tests passed

- Invalid session token hash rejected
- Expired session rejected
- Session expiration exceeding maximum lifetime rejected
- Unknown user/tenant identity rejected

### Authentication integration results

- Registration, login, logout, session verification, and protected dashboard exercised during development
- Reset email delivery, one-time tokens, new-password login, and previous-session revocation verified
- Login rate limiting confirmed by `HTTP 429` beginning on the sixth attempt in a fresh window

**Additional tests pending:** Fresh browser regression following Migration 010; comprehensive registration/password-recovery HTTP abuse tests; privileged database function misuse tests.

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
├── package-lock.json
└── README.md
```

---

## 14. Known Limitations and Security Work Remaining

### High-priority review items

- **Privileged database functions:** `tenantflow_app` can execute `SECURITY DEFINER` functions for authentication, session creation, and password reset. Arguments to these functions may be abused if the application DB role is compromised; validation in Migration 010 is not complete privilege separation.
- **Tenant context trust:** The application database role can set `app.tenant_id`, so RLS assumes the context was chosen by trusted backend code.
- **Dependency audit:** Five high-severity development-tooling findings remain open through the ESLint dependency chain. Production-only audit reports zero vulnerabilities.
- **Rate-limit integration:** Complete registration/password-recovery HTTP tests, trustworthy IP/network throttling, and bot protection are pending.
- **Account enumeration:** Generic responses do not fully eliminate timing differences or other side channels.
- **Browser regression:** Explicit post-Migration-010 login → dashboard → refresh → logout verification is pending.
- **Operational security:** Production secrets, least-privilege database architecture, migrations, logging, and deployment configuration require additional review.

### Future features

- Booking management/calendar – Week 2
- Payments and pricing – Week 3
- Real-time functionality – Week 4
- Caching and application settings – Week 5
- Deployment and polish – Week 6

This repository has **not** undergone a full production security assessment.

---

## 15. Six-Week Internship Roadmap

| Week | Focus |
|---|---|
| 1 | Architecture, schema, tenant isolation, authentication, security |
| 2 | Booking APIs and calendar UI |
| 3 | Payments, webhooks, pricing |
| 4 | Real-time collaboration |
| 5 | Caching and settings |
| 6 | Deployment, documentation, final polish |

---

## 16. Git Workflow

| Branch | Purpose |
|---|---|
| `main` | Stable submission branch |
| `week/01-foundation` | Week 1 work and security review |
| Future weekly branches | Later features |

Workflow: implement on the weekly branch, test, commit, push, review, and merge to `main` **only after required checks pass**.

Selected Week 1 commits:

```text
feat(security): rate limit password recovery requests
feat(security): protect login with persistent rate limiting
fix(security): validate authentication session integrity
test(security): verify tenant write isolation policies
docs: update Week 1 security testing and project documentation
chore(deps): update zod to 4.6.7
```

---

## 17. Project Status

**Week 1: Foundation implemented; security review and final sign-off in progress.**

Implemented: tenant-aware PostgreSQL schema, RLS, organization registration, session-based authentication, password recovery, rate-limit integration, Migration 010 session integrity checks, and 11/11 successful tenant write-isolation scenarios.

Reviewed: Development dependency audit identifies an unresolved advisory in the ESLint transitive dependency chain; production-only audit currently reports zero vulnerabilities. Zod patch update passed static checks and build.

Remaining: Elevated-function/credential trust boundary design, full authentication regressions, additional abuse prevention, and final branch review/merge.

---

## 18. Documentation Maintenance Guide

**When adding a feature, update the relevant README section rather than appending unrelated notes at the end.** Use this table as the future maintenance map:

| Future change | Update these sections |
|---|---|
| New UI page or API endpoint | **1** (capabilities), **11** (routes), **13** (structure), **17** (status) |
| New database table, foreign key, RLS policy | **4** (schema/ERD), **5** (security), **9** (migrations), **13** (structure) |
| New migration (`011_...sql`, etc.) | **9** (migration table), **13** (structure), **12** (tests) |
| Authentication, sessions, password recovery | **6**, **7**, **8**, **12**, **14** |
| Security test or vulnerability fix | **12** (test/audit results), **14** (remaining risks), **17** (status) |
| New dependency or version update | **2** (stack), **12** (audit), **10** (setup, if relevant) |
| New environment variable or deployment prerequisite | **10** (setup), `.env.example` (placeholders only) |
| Weekly deliverable or milestone | **1** (overview), **15** (roadmap), **16** (workflow), **17** (status) |

**Documentation update checklist**

- [ ] Feature/bugfix is implemented and tested before marking it complete.
- [ ] API route and project tree reflect new files.
- [ ] Database migrations and ERD reflect schema changes.
- [ ] Security test results distinguish verified behavior from pending work.
- [ ] Dependency versions and audit results match current local outputs.
- [ ] README contains no secret values, API keys, or personal tokens.
- [ ] `npx tsc --noEmit`, `npx eslint .`, and `npm run build` pass after code changes.
- [ ] Documentation is committed on the active weekly branch.

---

**Repository:** https://github.com/foryasith/tenantflow  
**Internship:** Parallax Labs – Full-Stack Developer Internship
