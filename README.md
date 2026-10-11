
# TenantFlow – Multi-Tenant SaaS Booking Platform

**Parallax Labs | Full-Stack Developer Internship | Week 1**

TenantFlow is a full-stack SaaS booking platform that enables multiple organizations to use one application while keeping their data isolated.

## Tech Stack

- Next.js 16, React, TypeScript
- Tailwind CSS
- PostgreSQL 16 and node-postgres
- Docker Compose
- Zod and bcryptjs
- Database-backed authentication with HTTP-only session cookies
- Git and GitHub

## Week 1 Features

- Dockerized PostgreSQL setup
- Multi-tenant database schema
- Organizations, users, roles, bookings and sessions
- PostgreSQL Row-Level Security
- Transaction-scoped tenant context
- Organization and owner registration
- Password hashing
- Login and logout APIs
- Session authentication
- Responsive login and registration interfaces
- Protected organization dashboard
- Database health endpoint
- Sample tenant data and isolation tests

## System Architecture

```mermaid
flowchart TD
    A[React and Next.js UI] --> B[Next.js API Routes]
    B --> C[Zod Validation]
    C --> D[Authentication Layer]
    D --> E[PostgreSQL]
    E --> F[Row-Level Security]
    F --> G[Tenant-Scoped Data]
```

## Database ER Diagram

```mermaid
erDiagram
    ORGANIZATIONS ||--o{ USERS : has
    ORGANIZATIONS ||--o{ BOOKINGS : owns
    ORGANIZATIONS ||--o{ AUTH_SESSIONS : scopes
    ROLES ||--o{ USERS : assigned
    USERS ||--o{ BOOKINGS : creates
    USERS ||--o{ AUTH_SESSIONS : authenticates

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
```

## Tenant Isolation Strategy

PostgreSQL Row-Level Security (RLS) is enabled for organizations, users and bookings.

Tenant-specific database operations use a restricted database role and transaction-scoped tenant context.

The protected dashboard obtains its tenant identifier from a verified session, not directly from user input.

A composite foreign key ensures that booking creators belong to the same organization as their bookings.

Database functions with elevated privileges support organization provisioning and authentication. These functions require further privilege hardening before production deployment.

## Local Installation

### Prerequisites

- Node.js and npm
- Docker Desktop
- Git

### 1. Clone the repository

```bash
git clone https://github.com/foryasith/tenantflow.git
cd tenantflow
npm install
```

### 2. Start PostgreSQL

```bash
docker compose up -d
```

### 3. Configure environment

Create `.env.local` using `.env.example`.

For the current local development database:

```env
DATABASE_URL=postgresql://tenantflow_app:local_app_password@127.0.0.1:5433/tenantflow
```

These are development-only credentials. Do not use them in production.

### 4. Apply database migrations

For a fresh database, run migrations 001 through 006 in numerical order.

Using PowerShell:

```powershell
1..6 | ForEach-Object {
    $file = Get-ChildItem database/migrations -Filter ("{0:D3}_*.sql" -f $_)
    if ($file) {
        docker cp $file.FullName "tenantflow-db:/tmp/migration.sql"
        docker exec tenantflow-db psql -X -v ON_ERROR_STOP=1 -U postgres -d tenantflow -f /tmp/migration.sql
        if ($LASTEXITCODE -ne 0) { throw "Migration failed: $($file.Name)" }
    }
}
```

Run the seed file:

```powershell
docker cp database/seeds/001_demo_data.sql tenantflow-db:/tmp/seed.sql
docker exec tenantflow-db psql -X -v ON_ERROR_STOP=1 -U postgres -d tenantflow -f /tmp/seed.sql
```

Migrations and seed data are intended for initial development setup, not repeated execution on an existing database.

### 5. Run the application

```bash
npm run dev
```

Open http://localhost:3000/login

### 6. Build the application

```bash
npm run build
```

## Application Routes

| Route | Purpose |
|---|---|
| /register | Organization onboarding |
| /login | User authentication |
| /dashboard | Protected dashboard |
| /forgot-password | Password recovery information |
| /api/health | Database health check |
| /api/auth/register | Registration API |
| /api/auth/login | Login API |
| /api/auth/logout | Logout API |
| /api/auth/me | Current session verification |

## Testing

Verified during development:

- TypeScript and ESLint checks
- Successful Next.js production build
- Organization creation and bcrypt password hashing
- Login returning HTTP 200
- Session verification
- Logout followed by HTTP 401
- Tenant Alpha sees Alpha booking only
- Tenant Beta sees Beta booking only
- No tenant context returns zero bookings

## Known Limitations

- Functional password reset and email delivery are not implemented.
- Booking creation and calendar management are planned for Week 2.
- Tenant write-isolation tests remain incomplete.
- Database authentication functions need further privilege hardening.
- Rate limiting, email verification and additional production security protections are not yet implemented.
- The project has not been deployed to production.

## Six-Week Roadmap

| Week | Focus |
|---|---|
| 1 | Architecture, schema, tenant isolation, authentication |
| 2 | Booking APIs and calendar UI |
| 3 | Payments, webhooks and pricing |
| 4 | Real-time collaboration |
| 5 | Redis caching and settings |
| 6 | Docker, migrations and final polish |

## Git Workflow

- `main`: Stable submission branch
- `week/01-foundation`: Week 1 development
- Future weeks use separate weekly branches
- Changes are merged into main following review and testing

## Project Status

Week 1 core foundation implemented. Remaining requirements and known security limitations are documented above.
