-- ============================================
-- HAWK CENTRAL DATABASE SCHEMA (SIMPLIFIED)
-- Simplified foundation to build upon
-- Run this file to set up the basic database
-- ============================================

-- Drop existing tables if they exist (for clean reinstall)
DROP TABLE IF EXISTS event_photos CASCADE;
DROP TABLE IF EXISTS event_comments CASCADE;
DROP TABLE IF EXISTS password_reset_tokens CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS campus_locations CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================
-- TABLE CREATION (In dependency order)
-- ============================================

-- Table 1: Users (no dependencies)
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'normal_user',
    student_id VARCHAR(50),
    major VARCHAR(100),
    graduation_year INTEGER,
    bio TEXT,
    profile_picture VARCHAR(500),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    CONSTRAINT check_role CHECK (role IN ('normal_user', 'it_admin', 'super_admin'))
);

-- Table 2: Categories (no dependencies)
CREATE TABLE categories (
    category_id SERIAL PRIMARY KEY,
    category_name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    color VARCHAR(7),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table 3: Campus Locations (no dependencies)
CREATE TABLE campus_locations (
    location_id SERIAL PRIMARY KEY,
    location_name VARCHAR(255) NOT NULL,
    building_name VARCHAR(200),
    room_number VARCHAR(50),
    campus_area VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table 4: Password Reset Tokens (depends on users)
CREATE TABLE password_reset_tokens (
    token_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    reset_token VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table 5: Events (depends on users, categories, campus_locations)
CREATE TABLE events (
    event_id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    event_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME,
    location_id INTEGER REFERENCES campus_locations(location_id) ON DELETE SET NULL,
    category_id INTEGER NOT NULL REFERENCES categories(category_id) ON DELETE RESTRICT,
    organizer_name VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255),
    image_url VARCHAR(500),
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    max_capacity INTEGER,
    created_by INTEGER NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT check_times CHECK (end_time IS NULL OR start_time < end_time)
);

-- Table 6: Event Comments (depends on events and users)
CREATE TABLE event_comments (
    comment_id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    comment_text TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table 7: Event Photos (depends on events)
CREATE TABLE event_photos (
    photo_id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
    photo_url VARCHAR(500) NOT NULL,
    caption TEXT,
    uploaded_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_password_reset_token ON password_reset_tokens(reset_token);
CREATE INDEX idx_events_date ON events(event_date);
CREATE INDEX idx_events_created_by ON events(created_by);
CREATE INDEX idx_events_category ON events(category_id);
CREATE INDEX idx_events_location ON events(location_id);
CREATE INDEX idx_events_is_active ON events(is_active);
CREATE INDEX idx_event_comments_event ON event_comments(event_id);
CREATE INDEX idx_event_comments_user ON event_comments(user_id);
CREATE INDEX idx_event_photos_event ON event_photos(event_id);

-- ============================================
-- SETUP COMPLETE!
-- Simplified schema with 7 core tables created
-- ============================================
