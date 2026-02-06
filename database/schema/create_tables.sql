-- ============================================
-- HAWK CENTRAL DATABASE TABLES
-- ============================================

-- USERS TABLE
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL, -- normal_user, it_admin, super_admin
    student_id VARCHAR(20),
    major VARCHAR(100),
    graduation_year INT,
    bio TEXT,
    email_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE
);

-- CATEGORIES TABLE
CREATE TABLE categories (
    category_id SERIAL PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    color VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE
);

-- LOCATIONS TABLE
CREATE TABLE locations (
    location_id SERIAL PRIMARY KEY,
    location_name VARCHAR(255) NOT NULL,
    building_name VARCHAR(255),
    room_number VARCHAR(50),
    campus_area VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE
);

-- EVENTS TABLE
CREATE TABLE events (
    event_id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    event_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    location_id INT REFERENCES locations(location_id),
    category_id INT REFERENCES categories(category_id),
    organizer_name VARCHAR(255),
    contact_email VARCHAR(255),
    is_public BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE,
    max_capacity INT,
    created_by INT REFERENCES users(user_id),
    is_active BOOLEAN DEFAULT TRUE
);

-- EVENT COMMENTS TABLE
CREATE TABLE event_comments (
    comment_id SERIAL PRIMARY KEY,
    event_id INT REFERENCES events(event_id),
    user_id INT REFERENCES users(user_id),
    comment_text TEXT NOT NULL
);

-- EVENT PHOTOS TABLE
CREATE TABLE event_photos (
    photo_id SERIAL PRIMARY KEY,
    event_id INT REFERENCES events(event_id),
    photo_url TEXT,
    caption TEXT,
    uploaded_by INT REFERENCES users(user_id)
);

-- EVENT ATTENDEES / RSVP TABLE
CREATE TABLE event_attendees (
    event_id INT REFERENCES events(event_id),
    user_id INT REFERENCES users(user_id),
    rsvp_status VARCHAR(20), -- attending, maybe, not_attending
    PRIMARY KEY (event_id, user_id)
);

-- SAVED EVENTS TABLE
CREATE TABLE saved_events (
    user_id INT REFERENCES users(user_id),
    event_id INT REFERENCES events(event_id),
    PRIMARY KEY (user_id, event_id)
);
