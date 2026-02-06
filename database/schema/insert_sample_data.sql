-- ============================================
-- SAMPLE DATA
-- ============================================

-- USERS
INSERT INTO users (email, password_hash, first_name, last_name, role, student_id, major, graduation_year, bio, email_verified, is_active)
VALUES 
('alice.johnson@hawk.edu', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5jtJ3yynCdPni', 'Alice', 'Johnson', 'normal_user', 'S12345678', 'Biology', 2027, 'Love organizing study groups!', TRUE, TRUE),
('marcus.williams@hawk.edu', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5jtJ3yynCdPni', 'Marcus', 'Williams', 'normal_user', 'S87654321', 'Communications', 2026, 'Campus event coordinator', TRUE, TRUE),
('itadmin@hawk.edu', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5jtJ3yynCdPni', 'Sarah', 'Chen', 'it_admin', NULL, NULL, NULL, 'IT Administrator', TRUE, TRUE),
('admin@hawk.edu', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5jtJ3yynCdPni', 'Dr. Robert', 'Martinez', 'super_admin', NULL, NULL, NULL, 'System Administrator', TRUE, TRUE);

-- CATEGORIES
INSERT INTO categories (category_name, description, icon, color, is_active)
VALUES
('Sports & Recreation', 'Athletic events, games, fitness activities', 'basketball', '#FF5733', TRUE),
('Academic & Study', 'Study groups, tutoring, lectures', 'book', '#3498DB', TRUE),
('Social & Networking', 'Parties, mixers, social gatherings', 'users', '#9B59B6', TRUE),
('Clubs & Organizations', 'Club meetings, recruitment events', 'flag', '#1ABC9C', TRUE),
('Career & Professional', 'Career fairs, networking, internships', 'briefcase', '#34495E', TRUE),
('Arts & Culture', 'Concerts, theater, art exhibitions', 'palette', '#E74C3C', TRUE);

-- LOCATIONS
INSERT INTO locations (location_name, building_name, room_number, campus_area, is_active)
VALUES
('Student Center Ballroom', 'Student Center', 'Main Ballroom', 'Central Campus', TRUE),
('Student Center Room 205', 'Student Center', 'Room 205', 'Central Campus', TRUE),
('Hawks Sports Arena', 'Sports Arena', NULL, 'South Campus', TRUE),
('Library Study Room A', 'Library', 'Study Room A', 'North Campus', TRUE),
('Campus Quad', 'Outdoor Space', NULL, 'Central Campus', TRUE),
('Engineering Building Lab 101', 'Engineering Building', 'Lab 101', 'East Campus', TRUE);

-- EVENTS
INSERT INTO events (title, description, event_date, start_time, end_time, location_id, category_id, organizer_name, contact_email, is_public, max_capacity, created_by)
VALUES 
('Hawks Basketball vs State University', 'Come support our Hawks! Free admission for students with valid ID.', '2026-02-15', '19:00', '21:00', 3, 1, 'Athletics Department', 'athletics@hawk.edu', TRUE, 2000, 2),
('CS 101 Midterm Study Session', 'Midterm prep session covering chapters 1-5. Pizza will be provided!', '2026-02-10', '18:00', '20:00', 4, 2, 'Alice Johnson', 'alice.johnson@hawk.edu', TRUE, 15, 1),
('Spring Career Fair 2026', 'Meet with 50+ employers hiring for internships and full-time positions. Dress professionally!', '2026-02-20', '10:00', '15:00', 1, 5, 'Career Services', 'careers@hawk.edu', TRUE, 500, 2),
('Open Mic Night', 'Showcase your talent! Poetry, music, comedy - all welcome. Sign up at the door.', '2026-02-12', '20:00', '22:30', 5, 6, 'Student Activities Board', 'sab@hawk.edu', TRUE, 200, 2),
('Biology Club Meeting', 'First meeting of the semester. Discussing upcoming field trips and lab opportunities.', '2026-02-08', '17:00', '18:30', 2, 4, 'Biology Club', 'bioclub@hawk.edu', TRUE, 50, 1);

-- EVENT COMMENTS
INSERT INTO event_comments (event_id, user_id, comment_text)
VALUES
(1, 1, 'So excited for this game! Let''s go Hawks! 🏀'),
(2, 2, 'Thanks for organizing this Alice! Really need help with recursion.'),
(3, 1, 'Will there be any tech companies attending?'),
(4, 2, 'I''m performing an original song - can''t wait!');

-- EVENT PHOTOS
INSERT INTO event_photos (event_id, photo_url, caption, uploaded_by)
VALUES
(1, 'https://example.com/photos/hawks-arena.jpg', 'Hawks Arena on game night', 2),
(3, 'https://example.com/photos/career-fair-2025.jpg', 'Last year''s career fair - huge turnout!', 2);
