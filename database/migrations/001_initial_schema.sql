
-- TenantFlow Week 1: Initial Database Schema

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Organizations
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Roles
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(30) NOT NULL UNIQUE
);

INSERT INTO roles (name)
VALUES ('OWNER'), ('ADMIN'), ('MEMBER');

-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL
        REFERENCES organizations(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id),
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (organization_id, email),
    UNIQUE (organization_id, id)
);

-- Bookings
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL
        REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL,
    title VARCHAR(200) NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_booking_time
        CHECK (end_time > start_time),

    CONSTRAINT valid_booking_status
        CHECK (status IN (
            'PENDING',
            'CONFIRMED',
            'CANCELLED'
        )),

    CONSTRAINT fk_booking_creator_tenant
        FOREIGN KEY (organization_id, created_by)
        REFERENCES users(organization_id, id)
);

-- Indexes
CREATE INDEX idx_users_organization
ON users(organization_id);

CREATE INDEX idx_bookings_organization
ON bookings(organization_id);

CREATE INDEX idx_bookings_start
ON bookings(start_time);
