-- ============================================
-- COMMON QUERIES FOR HAWK CENTRAL (SIMPLIFIED)
-- Useful SQL queries for backend development
-- Note: $1, $2, etc. are placeholders for parameters
-- ============================================

-- Get all public events with full details
SELECT 
    e.event_id,
    e.title,
    e.description,
    e.event_date,
    e.start_time,
    e.end_time,
    u.first_name || ' ' || u.last_name as creator_name,
    c.category_name,
    c.color as category_color,
    cl.location_name,
    cl.building_name,
    cl.room_number,
    e.max_capacity,
    e.image_url
FROM events e
JOIN users u ON e.created_by = u.user_id
JOIN categories c ON e.category_id = c.category_id
LEFT JOIN campus_locations cl ON e.location_id = cl.location_id
WHERE e.is_public = TRUE AND e.is_active = TRUE
ORDER BY e.event_date, e.start_time;

-- Get events happening in next 7 days
SELECT 
    e.*,
    c.category_name,
    c.color as category_color,
    cl.location_name,
    cl.building_name
FROM events e
JOIN categories c ON e.category_id = c.category_id
LEFT JOIN campus_locations cl ON e.location_id = cl.location_id
WHERE e.event_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
  AND e.is_active = TRUE
ORDER BY e.event_date, e.start_time;

-- Get events happening today
SELECT 
    e.*, 
    c.category_name,
    c.color as category_color,
    cl.location_name
FROM events e
JOIN categories c ON e.category_id = c.category_id
LEFT JOIN campus_locations cl ON e.location_id = cl.location_id
WHERE e.event_date = CURRENT_DATE
  AND e.is_active = TRUE
ORDER BY e.start_time;

-- Get user's created events
SELECT 
    e.*,
    c.category_name,
    cl.location_name
FROM events e
JOIN categories c ON e.category_id = c.category_id
LEFT JOIN campus_locations cl ON e.location_id = cl.location_id
WHERE e.created_by = $1  -- Replace $1 with user_id in backend
ORDER BY e.created_at DESC;

-- Get single event by ID with all details
SELECT 
    e.*,
    u.first_name || ' ' || u.last_name as creator_name,
    u.email as creator_email,
    c.category_name,
    c.color as category_color,
    c.icon as category_icon,
    cl.location_name,
    cl.building_name,
    cl.room_number,
    cl.campus_area
FROM events e
JOIN users u ON e.created_by = u.user_id
JOIN categories c ON e.category_id = c.category_id
LEFT JOIN campus_locations cl ON e.location_id = cl.location_id
WHERE e.event_id = $1;  -- Replace $1 with event_id

-- Get all comments for an event
SELECT 
    ec.*,
    u.first_name || ' ' || u.last_name as commenter_name,
    u.profile_picture
FROM event_comments ec
JOIN users u ON ec.user_id = u.user_id
WHERE ec.event_id = $1  -- Replace $1 with event_id
ORDER BY ec.created_at DESC;

-- Get all photos for an event
SELECT 
    ep.*,
    u.first_name || ' ' || u.last_name as uploader_name
FROM event_photos ep
LEFT JOIN users u ON ep.uploaded_by = u.user_id
WHERE ep.event_id = $1  -- Replace $1 with event_id
ORDER BY ep.uploaded_at DESC;

-- Search events by keyword (title or description)
SELECT 
    e.*, 
    c.category_name,
    cl.location_name
FROM events e
JOIN categories c ON e.category_id = c.category_id
LEFT JOIN campus_locations cl ON e.location_id = cl.location_id
WHERE (e.title ILIKE '%' || $1 || '%' OR e.description ILIKE '%' || $1 || '%')
  AND e.is_active = TRUE
ORDER BY e.event_date;

-- Get events by category
SELECT 
    e.*,
    cl.location_name
FROM events e
JOIN categories c ON e.category_id = c.category_id
LEFT JOIN campus_locations cl ON e.location_id = cl.location_id
WHERE c.category_name = $1  -- Replace $1 with category name
  AND e.is_active = TRUE
ORDER BY e.event_date;

-- Get events by category ID
SELECT 
    e.*, 
    c.category_name,
    cl.location_name
FROM events e
JOIN categories c ON e.category_id = c.category_id
LEFT JOIN campus_locations cl ON e.location_id = cl.location_id
WHERE e.category_id = $1  -- Replace $1 with category_id
  AND e.is_active = TRUE
ORDER BY e.event_date;

-- Get events by location
SELECT 
    e.*, 
    c.category_name
FROM events e
JOIN categories c ON e.category_id = c.category_id
JOIN campus_locations cl ON e.location_id = cl.location_id
WHERE cl.building_name = $1  -- Replace $1 with building name
  AND e.is_active = TRUE
ORDER BY e.event_date;

-- Get all active categories (for dropdown/filters)
SELECT * FROM categories
WHERE is_active = TRUE
ORDER BY category_name;

-- Get all active campus locations (for dropdown/filters)
SELECT * FROM campus_locations
WHERE is_active = TRUE
ORDER BY building_name, room_number;

-- Get user by email (for login)
SELECT * FROM users
WHERE email = $1 AND is_active = TRUE;

-- Get user profile with event count
SELECT 
    u.*,
    COUNT(e.event_id) as events_created
FROM users u
LEFT JOIN events e ON u.user_id = e.created_by AND e.is_active = TRUE
WHERE u.user_id = $1
GROUP BY u.user_id;

-- Add a comment to an event
INSERT INTO event_comments (event_id, user_id, comment_text)
VALUES ($1, $2, $3)  -- event_id, user_id, comment_text
RETURNING *;

-- Add a photo to an event
INSERT INTO event_photos (event_id, photo_url, caption, uploaded_by)
VALUES ($1, $2, $3, $4)  -- event_id, photo_url, caption, user_id
RETURNING *;

-- Create a new event
INSERT INTO events (
    title, description, event_date, start_time, end_time,
    location_id, category_id, organizer_name, contact_email,
    is_public, max_capacity, created_by
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
RETURNING *;

-- Update an event
UPDATE events
SET 
    title = $2,
    description = $3,
    event_date = $4,
    start_time = $5,
    end_time = $6,
    location_id = $7,
    category_id = $8,
    organizer_name = $9,
    contact_email = $10,
    max_capacity = $11,
    updated_at = CURRENT_TIMESTAMP
WHERE event_id = $1 AND created_by = $13  -- Ensure user owns the event
RETURNING *;

-- Delete (soft delete) an event
UPDATE events
SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
WHERE event_id = $1 AND created_by = $2  -- Ensure user owns the event
RETURNING *;

-- Get event count by category (for analytics/dashboard)
SELECT 
    c.category_name,
    c.color,
    COUNT(e.event_id) as event_count
FROM categories c
LEFT JOIN events e ON c.category_id = e.category_id AND e.is_active = TRUE
WHERE c.is_active = TRUE
GROUP BY c.category_id, c.category_name, c.color
ORDER BY event_count DESC;

-- Get upcoming events count by user
SELECT 
    COUNT(*) as upcoming_events
FROM events
WHERE created_by = $1
  AND event_date >= CURRENT_DATE
  AND is_active = TRUE;

-- ============================================
-- END OF COMMON QUERIES
-- ============================================
