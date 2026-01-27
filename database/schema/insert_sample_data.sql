-- ============================================
-- HAWK CENTRAL SAMPLE DATA
-- Insert test data for development
-- Run AFTER create_tables.sql
-- ============================================

-- Insert sample users (4 users)
INSERT INTO users (email, password_hash, first_name, last_name, role, student_id, major, graduation_year, bio, email_verified, is_active)
VALUES 
('alice.johnson@hawk.edu', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5jtJ3yynCdPni', 'Alice', 'Johnson', 'normal_user', 'S12345678', 'Biology', 2027, 'Love organizing study groups!', TRUE, TRUE),
('marcus.williams@hawk.edu', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5jtJ3yynCdPni', 'Marcus', 'Williams', 'normal_user', 'S87654321', 'Communications', 2026, 'Campus event coordinator', TRUE, TRUE),
('itadmin@hawk.edu', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5jtJ3yynCdPni', 'Sarah', 'Chen', 'it_admin', NULL, NULL, NULL, NULL, TRUE, TRUE),
('admin@hawk.edu', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5jtJ3yynCdPni', 'Dr. Robert', 'Martinez', 'super_admin', NULL, NULL, NULL, NULL, TRUE, TRUE);

-- Insert sample categories (5 categories)
INSERT INTO categories (category_name, description, icon, color, is_active) VALUES
('Sports & Recreation', 'Athletic events, games, fitness activities', 'basketball', '#FF5733', TRUE),
('Academic & Study', 'Study groups, tutoring, lectures', 'book', '#3498DB', TRUE),
('Social & Networking', 'Parties, mixers, social gatherings', 'users', '#9B59B6', TRUE),
('Clubs & Organizations', 'Club meetings, recruitment events', 'flag', '#1ABC9C', TRUE),
('Career & Professional', 'Career fairs, networking, internships', 'briefcase', '#34495E', TRUE);

-- Insert sample locations (5 locations)
INSERT INTO locations (building_name, room_number, campus_area, capacity, has_parking, floor_number, accessibility_notes, is_active) VALUES
('Student Center', 'Main Ballroom', 'Central Campus', 500, TRUE, 2, 'Elevator available, wheelchair accessible', TRUE),
('Student Center', 'Room 205', 'Central Campus', 50, TRUE, 2, 'Elevator available', TRUE),
('Sports Arena', NULL, 'South Campus', 2000, TRUE, 1, 'Wheelchair seating available', TRUE),
('Library', 'Study Room A', 'North Campus', 15, TRUE, 3, 'Elevator available', TRUE),
('Campus Quad', 'Outdoor', 'Central Campus', 1000, FALSE, NULL, 'Accessible pathways', TRUE);

-- Insert sample events (3 events)
INSERT INTO events (title, description, event_date, start_time, end_time, location_id, category_id, organizer_name, contact_email, is_public, max_capacity, created_by, is_featured)
VALUES 
('Hawks Basketball vs State University', 'Come support our Hawks! Free admission for students.', '2026-02-15', '19:00', '21:00', 3, 1, 'Athletics Department', 'athletics@hawk.edu', TRUE, 2000, 2, TRUE),
('CS 101 Study Group', 'Midterm prep session. Pizza provided!', '2026-02-10', '18:00', '20:00', 4, 2, 'Alice Johnson', 'alice.johnson@hawk.edu', FALSE, 15, 1, FALSE),
('Spring Career Fair', 'Meet with 50+ employers. Dress professionally!', '2026-02-20', '10:00', '15:00', 1, 5, 'Career Services', 'careers@hawk.edu', TRUE, 500, 2, TRUE);

-- ============================================
-- SAMPLE DATA COMPLETE!
-- Total inserted:
--   - 4 users (1 super_admin, 1 it_admin, 2 normal_users)
--   - 5 categories
--   - 5 locations  
--   - 3 events
-- ============================================