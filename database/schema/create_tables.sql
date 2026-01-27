-- ============================================
-- HAWK CENTRAL DATABASE SCHEMA
-- Creates all 10 tables with proper relationships
-- Run this file to set up the complete database
-- ============================================

-- Drop existing tables if they exist (for clean reinstall)
DROP TABLE IF EXISTS saved_events CASCADE;
DROP TABLE IF EXISTS event_attendees CASCADE;
DROP TABLE IF EXISTS event_reports CASCADE;
DROP TABLE IF EXISTS event_moderators CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS notification_preferences CASCADE;
DROP TABLE IF EXISTS password_reset_tokens CASCADE;
DROP TABLE IF EXISTS locations CASCADE;
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
    events_created_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    password_reset_required BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT check_role CHECK (role IN ('normal_user', 'it_admin', 'super_admin'))
);

-- Table 2: Categories (no dependencies)
CREATE TABLE categories (
    category_id SERIAL PRIMARY KEY,
    category_name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    color VARCHAR(7),
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Table 3: Locations (no dependencies)
CREATE TABLE locations (
    location_id SERIAL PRIMARY KEY,
    building_name VARCHAR(200) NOT NULL,
    room_number VARCHAR(50),
    full_address VARCHAR(500),
    campus_area VARCHAR(100),
    capacity INTEGER,
    has_parking BOOLEAN,
    floor_number INTEGER,
    accessibility_notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
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

-- Table 5: Notification Preferences (depends on users)
CREATE TABLE notification_preferences (
    preference_id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    notify_new_events BOOLEAN NOT NULL DEFAULT TRUE,
    notify_event_updates BOOLEAN NOT NULL DEFAULT TRUE,
    notify_event_reminders BOOLEAN NOT NULL DEFAULT TRUE,
    notify_rsvp_changes BOOLEAN NOT NULL DEFAULT TRUE,
    preferred_categories TEXT,
    email_frequency VARCHAR(50) NOT NULL DEFAULT 'daily_digest',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_email_frequency CHECK (email_frequency IN ('instant', 'daily_digest', 'weekly_digest', 'never'))
);

-- Table 6: Events (depends on users, categories, locations)
CREATE TABLE events (
    event_id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    event_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME,
    location_id INTEGER NOT NULL REFERENCES locations(location_id) ON DELETE RESTRICT,
    category_id INTEGER NOT NULL REFERENCES categories(category_id) ON DELETE RESTRICT,
    organizer_name VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255),
    image_url VARCHAR(500),
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    invite_code VARCHAR(50) UNIQUE,
    registration_required BOOLEAN NOT NULL DEFAULT FALSE,
    registration_link VARCHAR(500),
    max_capacity INTEGER,
    created_by INTEGER NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
    recurrence_rule VARCHAR(255),
    times_reported INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT check_times CHECK (end_time IS NULL OR start_time < end_time)
);

-- Table 7: Event Moderators (depends on events and users)
CREATE TABLE event_moderators (
    event_moderator_id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    promoted_by INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    can_edit BOOLEAN NOT NULL DEFAULT TRUE,
    can_manage_attendees BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, user_id)
);

-- Table 8: Event Reports (depends on events and users)
CREATE TABLE event_reports (
    report_id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
    reported_by INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    reason VARCHAR(50) NOT NULL,
    details TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    resolved_at TIMESTAMP,
    action_taken VARCHAR(255),
    UNIQUE(event_id, reported_by),
    CONSTRAINT check_reason CHECK (reason IN ('spam', 'inappropriate', 'fake', 'scam', 'other'))
);

-- Table 9: Event Attendees (depends on events and users)
CREATE TABLE event_attendees (
    attendee_id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    rsvp_status VARCHAR(50) NOT NULL,
    rsvp_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    attended BOOLEAN,
    checked_in_at TIMESTAMP,
    UNIQUE(event_id, user_id),
    CONSTRAINT check_rsvp_status CHECK (rsvp_status IN ('going', 'maybe', 'not_going'))
);

-- Table 10: Saved Events (depends on events and users)
CREATE TABLE saved_events (
    saved_event_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    event_id INTEGER NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
    saved_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    UNIQUE(user_id, event_id)
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_email_verified ON users(email_verified);
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_password_reset_token ON password_reset_tokens(reset_token);
CREATE INDEX idx_events_date ON events(event_date);
CREATE INDEX idx_events_created_by ON events(created_by);
CREATE INDEX idx_events_category ON events(category_id);
CREATE INDEX idx_events_location ON events(location_id);
CREATE INDEX idx_events_is_public ON events(is_public);
CREATE INDEX idx_events_is_active ON events(is_active);
CREATE INDEX idx_event_moderators_user ON event_moderators(user_id);
CREATE INDEX idx_event_attendees_user ON event_attendees(user_id);
CREATE INDEX idx_saved_events_user ON saved_events(user_id);
CREATE INDEX idx_event_reports_resolved ON event_reports(resolved);

-- ============================================
-- SETUP COMPLETE!
-- All 10 tables created with proper relationships
-- ============================================