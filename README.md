
# TenantFlow – Multi-Tenant SaaS Booking Platform

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss)
![Docker](https://img.shields.io/badge/Docker-Enabled-2496ED?logo=docker)
![Status](https://img.shields.io/badge/Status-Week_1_Security_Hardening-orange)

**Parallax Labs | Full-Stack Developer Internship | Week 1**

TenantFlow is a full-stack, multi-tenant SaaS booking platform built using Next.js, TypeScript, PostgreSQL, and Docker.

The application allows multiple organizations to share one platform while maintaining strict logical separation of their data.

Week 1 focuses on project architecture, organization onboarding, authentication, password recovery, database security, and tenant isolation.

---

## 1. Project Overview

TenantFlow provides a foundation for a Software-as-a-Service booking platform.

Each organization operates within its own workspace. Users belong to organizations, and PostgreSQL Row-Level Security (RLS) helps prevent one tenant from accessing another tenant's data.

### Core Capabilities

- Organization and owner registration
- Multi-tenant database architecture
- Role-based user model
- Authentication and session management
- Protected organization dashboard
- Password recovery through email
- Single-use reset tokens
- Persistent authentication rate limiting
- PostgreSQL Row-Level Security
- Dockerized local development

Booking management, calendar functionality, payments, and additional SaaS capabilities are planned for later internship weeks.

---

## 2. Technology Stack

| Category | Technology |
|---|---|
| Frontend | Next.js 16, React, TypeScript |
| Styling | Tailwind CSS 4 |
| Backend | Next.js App Router API Routes |
| Database | PostgreSQL 16 |
| Database Client | node-postgres (`pg`) |
| Containerization | Docker, Docker Compose |
| Authentication | Database-backed sessions |
| Password Hashing | bcryptjs |
| Validation | Zod |
| Email Service | Resend |
| Rate Limiting | PostgreSQL, HMAC-SHA256 |
| Version Control | Git, GitHub |

---

## 3. System Architecture

```mermaid
flowchart TD
    A[User Browser] --> B[Next.js Application]

    B --> C[React Frontend]
    B --> D[API Routes]

    D --> E[Zod Validation]
    E --> F[Authentication and Security]

    F --> G[Session Management]
    F --> H[Rate Limiting]
    F --> I[Password Recovery]

    G --> J[(PostgreSQL)]
    H --> J
    I --> J

    I --> K[Resend Email API]

    J --> L[Row-Level Security]
    L --> M[Tenant-Isolated Data]
```

### Architecture Principles

1. **Shared application:** Multiple organizations use the same Next.js deployment.
2. **Shared database:** Tenant-owned data is stored in PostgreSQL.
3. **Tenant isolation:** Row-Level Security restricts access to tenant-owned rows.
4. **Server-side authentication:** Session validation is performed by the backend.
5. **Restricted access:** The application uses a dedicated PostgreSQL role.
6. **Defense in depth:** Validation, password hashing, session protection, and rate limiting reduce common authentication risks.

---

## 4. Database Design

The database contains the following core tables:

| Table | Purpose |
|---|---|
| `organizations` | Organization and workspace information |
| `roles` | OWNER, ADMIN, MEMBER roles |
| `users` | Organization users and password hashes |
| `bookings` | Tenant-owned booking records |
| `auth_sessions` | Server-side authentication sessions |
| `password_reset_tokens` | Time-limited password recovery tokens |
| `auth_rate_limits` | Persistent authentication request counters |

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
        string name
        string slug UK
        timestamp created_at
    }

    ROLES {
        uuid id PK
        string name UK
    }

    USERS {
        uuid id PK
        uuid organization_id FK
        uuid role_id FK
        string full_name
        string email
        string password_hash
    }

    BOOKINGS {
        uuid id PK
        uuid organization_id FK
        uuid created_by FK
        string title
        timestamp start_time
        timestamp end_time
        string status
    }

    AUTH_SESSIONS {
        uuid id PK
        uuid user_id FK
        uuid organization_id FK
        string token_hash
        timestamp expires_at
    }

    PASSWORD_RESET_TOKENS {
        uuid id PK
        uuid user_id FK
        string token_hash UK
        timestamp expires_at
        timestamp used_at
        timestamp created_at
    }

    AUTH_RATE_LIMITS {
        string rate_key PK
        int attempt_count
        timestamp window_expires_at
        timestamp updated_at
    }
```

The `auth_rate_limits` table contains keyed security counters rather than a direct foreign-key relationship to an organization or user.

---

## 5. Multi-Tenant Security

TenantFlow uses PostgreSQL Row-Level Security to isolate organization data.

### Tenant Context

Tenant-specific database operations use a transaction-scoped tenant identifier:

```sql
SELECT set_config('app.tenant_id', $1, true);
```

The tenant identifier must be obtained from a verified session rather than trusted directly from a user request.

### Security Features

- Row-Level Security policies
- Dedicated application database role
- Tenant-aware data access
- Transaction-scoped tenant context
- Composite foreign-key constraints
- Restricted direct access to protected tables
- Security-definer functions for selected authentication operations

### Database Isolation

The database includes tests demonstrating that:

- Tenant Alpha can read its own bookings.
- Tenant Beta can read its own bookings.
- A tenant cannot read another tenant's protected booking records.
- Queries without a valid tenant context return no protected bookings.

Additional tenant write-isolation and privileged-function tests are planned before the final Week 1 security sign-off.

---

## 6. Authentication

TenantFlow uses database-backed session authentication.

### User Registration

Organization registration performs the following operations:

1. Validate registration details using Zod.
2. Generate a unique organization slug.
3. Hash the password using bcrypt.
4. Create an organization and owner account.
5. Return the organization identifier and workspace slug.

### Login

Users log in using:

- Organization workspace slug
- Email address
- Password

After successful authentication, the server creates a session and sets an HTTP-only cookie.

### Session Security

- HTTP-only session cookies
- `SameSite=Lax`
- Secure cookies in production mode
- Hashed session tokens in PostgreSQL
- Session expiration
- Server-side session validation
- Logout and session revocation

### Protected Dashboard

The dashboard requires a valid authenticated session and displays organization-scoped information.

---

## 7. Password Recovery

TenantFlow supports email-based password recovery using Resend.

### Password Reset Workflow

```mermaid
sequenceDiagram
    participant U as User
    participant UI as Next.js Frontend
    participant API as Authentication API
    participant DB as PostgreSQL
    participant E as Resend

    U->>UI: Enter workspace slug and email
    UI->>API: POST /api/auth/forgot-password
    API->>DB: Check rate limit
    API->>DB: Store hashed reset token
    API->>E: Request reset email delivery
    E-->>U: Password reset email

    U->>UI: Open reset link
    U->>UI: Enter new password
    UI->>API: POST /api/auth/reset-password
    API->>DB: Validate and consume token
    API->>DB: Update password hash
    API->>DB: Revoke previous sessions
    API-->>UI: Password updated
    U->>UI: Login with new password
```

### Password Reset Security

- Cryptographically random reset tokens
- SHA-256 token hashes stored in PostgreSQL
- 15-minute token expiration
- Single-use token enforcement
- bcrypt hashing for new passwords
- Revocation of previous login sessions
- Generic password recovery responses
- Password reset request throttling

### Verified End-to-End Tests

| Test | Result |
|---|---|
| Forgot Password request | Passed |
| Reset email received | Passed |
| Reset link opens | Passed |
| New password saved | Passed |
| Login with new password | Passed |
| Old password rejected | Passed |
| Reused token rejected (HTTP 400) | Passed |
| Previous session rejected (HTTP 401) | Passed |

---

## 8. Authentication Rate Limiting

TenantFlow uses a PostgreSQL-backed rate limiter.

A shared helper generates HMAC-SHA256 keys from normalized request identities so raw email addresses are not stored in rate-limit records.

### Current Rate Limit Policy

| Endpoint | Maximum requests | Window |
|---|---|---|
| Login | 5 | 15 minutes |
| Forgot Password | 3 | 15 minutes |
| Registration | 3 | 60 minutes |

The login and password recovery routes use the shared database-backed rate limiter.

Registration rate-limit integration has been added and requires final integration-test verification.

### Login Rate Limit Test

```text
Attempt 1: HTTP 401
Attempt 2: HTTP 401
Attempt 3: HTTP 401
Attempt 4: HTTP 401
Attempt 5: HTTP 401
Attempt 6: HTTP 429
Attempt 7: HTTP 429
```

The login rate-limit behavior was verified using PowerShell HTTP requests and PostgreSQL counter queries.

### Current Limitations

- Rate limiting is currently identity-based.
- All login requests count toward the limit, including successful attempts.
- Trusted IP/network-level throttling is not implemented.
- Registration protection can be bypassed by rotating email identities.
- Bot mitigation is not implemented.
- Fixed `Retry-After` values may differ from the remaining rate-limit window.

Additional protections are required before public production deployment.

---

## 9. Database Migrations

The project includes incremental PostgreSQL migrations.

| Migration | Purpose |
|---|---|
| `001_initial_schema.sql` | Organizations, users, roles, bookings |
| `002_tenant_rls.sql` | Tenant Row-Level Security |
| `003_auth_sessions.sql` | Database-backed authentication sessions |
| `004_organization_provisioning.sql` | Organization and owner creation |
| `005_auth_functions.sql` | Authentication helper functions |
| `006_revoke_auth_session.sql` | Session revocation support |
| `007_password_reset_tokens.sql` | Password recovery token storage |
| `008_password_reset_functions.sql` | Password reset and session revocation |
| `009_auth_rate_limiting.sql` | Persistent authentication rate limiting |
| `010_auth_session_integrity.sql` | Session token, expiry and user-tenant integrity validation |

Run migrations in numerical order on a fresh database.

Migrations in this repository are development migrations and are not designed to be repeatedly executed against an existing database.

---

## 10. Local Development Setup

### Prerequisites

- Node.js and npm
- Docker Desktop
- Git

### Step 1: Clone the Repository

```bash
git clone https://github.com/foryasith/tenantflow.git
cd tenantflow
npm install
```

### Step 2: Start PostgreSQL

```powershell
docker compose up -d
docker ps
```

Check database readiness:

```powershell
docker exec tenantflow-db pg_isready -U postgres -d tenantflow
```

### Step 3: Configure Environment Variables

Create a `.env.local` file in the project root.

The following variables are required for the corresponding development features:

```env
DATABASE_URL=postgresql://tenantflow_app:YOUR_LOCAL_PASSWORD@127.0.0.1:5433/tenantflow

RESEND_API_KEY=YOUR_RESEND_API_KEY
EMAIL_FROM="TenantFlow <YOUR_VERIFIED_SENDER>"
APP_URL=http://localhost:3000

AUTH_RATE_LIMIT_SECRET=YOUR_RANDOM_SECRET
```

Use your actual local database credentials, Resend credentials, verified sender configuration, and a cryptographically random rate-limit secret.

Generate a development rate-limit secret with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Never commit `.env.local`, production credentials, API keys, or secrets.

### Step 4: Apply Database Migrations

For a fresh PostgreSQL database, apply the migration files in numerical order.

PowerShell:

```powershell
Get-ChildItem database/migrations -Filter "*.sql" |
  Sort-Object Name |
  ForEach-Object {
    $file = $_

    Write-Host "Applying $($file.Name)"

    docker cp $file.FullName tenantflow-db:/tmp/migration.sql

    if ($LASTEXITCODE -ne 0) {
      throw "Failed to copy $($file.Name)"
    }

    docker exec tenantflow-db psql `
      -X `
      -v ON_ERROR_STOP=1 `
      -1 `
      -U postgres `
      -d tenantflow `
      -f /tmp/migration.sql

    if ($LASTEXITCODE -ne 0) {
      throw "Migration failed: $($file.Name)"
    }
  }
```

Run this only against a newly initialized database that has not already received these migrations.

### Step 5: Load Demo Data

```powershell
docker cp database/seeds/001_demo_data.sql tenantflow-db:/tmp/seed.sql

docker exec tenantflow-db psql `
  -X `
  -v ON_ERROR_STOP=1 `
  -U postgres `
  -d tenantflow `
  -f /tmp/seed.sql
```

The seed data is intended for initial development setup.

### Step 6: Start Next.js

```powershell
npm run dev
```

Open:

http://localhost:3000

### Step 7: Run a Production Build

```powershell
npm run build
```

---

## 11. Application Routes

### Frontend Routes

| Route | Description |
|---|---|
| `/` | Application landing page |
| `/register` | Organization registration |
| `/login` | User login |
| `/dashboard` | Protected organization dashboard |
| `/forgot-password` | Request a password reset |
| `/reset-password` | Set a new password |

### API Routes

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Database health check |
| POST | `/api/auth/register` | Create organization and owner |
| POST | `/api/auth/login` | Authenticate user |
| POST | `/api/auth/logout` | Revoke session |
| GET | `/api/auth/me` | Retrieve current session user |
| POST | `/api/auth/forgot-password` | Request password recovery |
| POST | `/api/auth/reset-password` | Update password using reset token |

---

## 12. Testing and Quality Assurance

### Static Checks

```powershell
npx tsc --noEmit
npx eslint .
```

### Production Build

```powershell
npm run build
```

### Health Check

```powershell
Invoke-RestMethod http://localhost:3000/api/health
```

### Database Verification

```powershell
docker exec tenantflow-db psql -U postgres -d tenantflow -c "\dt"
```

### Authentication Testing

Verified during local development:

- Organization registration
- Login with valid credentials
- Rejection of invalid credentials
- Logout
- Session verification
- Protected dashboard
- Password reset email delivery
- Password reset with valid token
- Single-use reset token enforcement
- Previous-session invalidation
- Login rate-limit enforcement

### Tenant Isolation Testing

Initial database read-isolation tests demonstrated:

- Organization-specific booking visibility
- Cross-tenant read restrictions
- No protected booking visibility without tenant context

Automated tenant write-isolation tests and broader authorization tests remain pending.

---

## 13. Project Structure

```text
tenantflow/
│
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
│   │   └── 009_auth_rate_limiting.sql
│   │
│   ├── seeds/
│   │   └── 001_demo_data.sql
│   │
│   └── tests/
│       └── 001_tenant_isolation.sql
│
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
│   │   │
│   │   ├── dashboard/
│   │   ├── login/
│   │   ├── register/
│   │   ├── forgot-password/
│   │   ├── reset-password/
│   │   ├── layout.tsx
│   │   └── globals.css
│   │
│   ├── components/
│   │   └── auth/
│   │
│   └── lib/
│       ├── auth.ts
│       ├── db.ts
│       ├── email.ts
│       ├── rate-limit.ts
│       └── validations/
│
├── public/
├── .env.example
├── next.config.ts
├── postcss.config.mjs
├── package.json
└── README.md
```

---

## 14. Known Limitations and Security Work Remaining

Week 1 core functionality is implemented, but additional hardening is still in progress.

### Remaining Security Work

- Complete registration rate-limit integration tests
- Harden privileged PostgreSQL authentication functions
- Add full tenant write-isolation tests
- Expand authentication edge-case tests
- Review account-enumeration timing differences
- Review dependency vulnerabilities using `npm audit`
- Add trusted IP/network-based throttling
- Add registration bot protection
- Review email verification requirements
- Validate production deployment security settings

### Functional Limitations

- Booking creation and editing are planned for Week 2.
- Calendar management is not yet implemented.
- Payments, real-time capabilities and caching are future work.
- The current project is not certified production-ready.

---

## 15. Six-Week Internship Roadmap

| Week | Focus |
|---|---|
| 1 | Foundation, authentication, tenant isolation and security |
| 2 | Booking APIs and calendar UI |
| 3 | Payments, webhooks and pricing |
| 4 | Real-time collaboration |
| 5 | Caching and advanced SaaS features |
| 6 | Deployment, migrations, documentation and final polish |

---

## 16. Git Workflow

Development follows a branch-based workflow.

| Branch | Purpose |
|---|---|
| `main` | Stable submission branch |
| `week/01-foundation` | Week 1 implementation |
| Future weekly branches | Upcoming internship tasks |

### Development Process

1. Implement features on the weekly branch.
2. Run TypeScript, ESLint and production build checks.
3. Test relevant functionality.
4. Create meaningful Git commits.
5. Push changes to GitHub.
6. Review and merge tested changes into `main`.

### Commit Examples

```text
feat(auth): implement password recovery UI and email API
feat(security): add persistent authentication rate limit storage
feat(security): rate limit password recovery requests
feat(security): protect login with persistent rate limiting
feat(security): add registration request rate limiting
docs: update Week 1 authentication and security progress
```

---

## 17. Project Status

**Week 1: Core foundation implemented; final security hardening in progress.**

Completed capabilities include multi-tenant PostgreSQL architecture, organization onboarding, authentication, protected dashboard, email-based password recovery, single-use reset tokens, session revocation, and login/password-recovery rate limiting.

Registration protection has been integrated and awaits final test verification.

Remaining work includes privileged database-function hardening, broader tenant-isolation testing, dependency security review, and final Week 1 sign-off.

---

## Repository

**GitHub:** https://github.com/foryasith/tenantflow

**Internship:** Parallax Labs – Full-Stack Developer Internship
