-- ============================================
-- COMMON QUERIES FOR HAWK CENTRAL
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
    l.building_name,
    l.room_number,
    e.max_capacity,
    e.is_featured
FROM events e
JOIN users u ON e.created_by = u.user_id
JOIN categories c ON e.category_id = c.category_id
JOIN locations l ON e.location_id = l.location_id
WHERE e.is_public = TRUE AND e.is_active = TRUE
ORDER BY e.event_date, e.start_time;

-- Get events happening in next 7 days
SELECT 
    e.*,
    c.category_name,
    l.building_name
FROM events e
JOIN categories c ON e.category_id = c.category_id
JOIN locations l ON e.location_id = l.location_id
WHERE e.event_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
  AND e.is_active = TRUE
ORDER BY e.event_date, e.start_time;

-- Get events happening today
SELECT e.*, c.category_name, l.building_name
FROM events e
JOIN categories c ON e.category_id = c.category_id
JOIN locations l ON e.location_id = l.location_id
WHERE e.event_date = CURRENT_DATE
  AND e.is_active = TRUE
ORDER BY e.start_time;

-- Get user's created events
SELECT e.* 
FROM events e
WHERE e.created_by = $1  -- Replace $1 with user_id in backend
ORDER BY e.created_at DESC;

-- Get single event by ID with all details
SELECT 
    e.*,
    u.first_name || ' ' || u.last_name as creator_name,
    u.email as creator_email,
    c.category_name,
    c.color as category_color,
    l.building_name,
    l.room_number,
    l.campus_area,
    l.accessibility_notes
FROM events e
JOIN users u ON e.created_by = u.user_id
JOIN categories c ON e.category_id = c.category_id
JOIN locations l ON e.location_id = l.location_id
WHERE e.event_id = $1;  -- Replace $1 with event_id

-- Count attendees for an event (by RSVP status)
SELECT 
    e.title,
    COUNT(CASE WHEN ea.rsvp_status = 'going' THEN 1 END) as going_count,
    COUNT(CASE WHEN ea.rsvp_status = 'maybe' THEN 1 END) as maybe_count,
    COUNT(CASE WHEN ea.rsvp_status = 'not_going' THEN 1 END) as not_going_count,
    e.max_capacity
FROM events e
LEFT JOIN event_attendees ea ON e.event_id = ea.event_id
WHERE e.event_id = $1  -- Replace $1 with event_id
GROUP BY e.event_id, e.title, e.max_capacity;

-- Check if user has RSVP'd to an event
SELECT rsvp_status, rsvp_date
FROM event_attendees
WHERE event_id = $1 AND user_id = $2;

-- Get all attendees for an event (for event owner)
SELECT 
    u.user_id,
    u.first_name,
    u.last_name,
    u.email,
    ea.rsvp_status,
    ea.rsvp_date
FROM event_attendees ea
JOIN users u ON ea.user_id = u.user_id
WHERE ea.event_id = $1
ORDER BY ea.rsvp_date DESC;

-- Search events by keyword (title or description)
SELECT e.*, c.category_name, l.building_name
FROM events e
JOIN categories c ON e.category_id = c.category_id
JOIN locations l ON e.location_id = l.location_id
WHERE (e.title ILIKE '%' || $1 || '%' OR e.description ILIKE '%' || $1 || '%')
  AND e.is_active = TRUE
ORDER BY e.event_date;

-- Get events by category
SELECT e.* 
FROM events e
JOIN categories c ON e.category_id = c.category_id
WHERE c.category_name = $1  -- Replace $1 with category name
  AND e.is_active = TRUE
ORDER BY e.event_date;

-- Get events by category ID
SELECT e.*, c.category_name, l.building_name
FROM events e
JOIN categories c ON e.category_id = c.category_id
JOIN locations l ON e.location_id = l.location_id
WHERE e.category_id = $1  -- Replace $1 with category_id
  AND e.is_active = TRUE
ORDER BY e.event_date;

-- Get events by location
SELECT e.*, c.category_name
FROM events e
JOIN categories c ON e.category_id = c.category_id
JOIN locations l ON e.location_id = l.location_id
WHERE l.building_name = $1  -- Replace $1 with building name
  AND e.is_active = TRUE
ORDER BY e.event_date;

-- Get user's saved events
SELECT 
    e.*,
    se.notes,
    se.saved_at,
    c.category_name,
    l.building_name
FROM saved_events se
JOIN events e ON se.event_id = e.event_id
JOIN categories c ON e.category_id = c.category_id
JOIN locations l ON e.location_id = l.location_id
WHERE se.user_id = $1
ORDER BY se.saved_at DESC;

-- Get events user is moderating
SELECT 
    e.*,
    em.can_edit,
    em.can_manage_attendees,
    c.category_name,
    l.building_name
FROM event_moderators em
JOIN events e ON em.event_id = e.event_id
JOIN categories c ON e.category_id = c.category_id
JOIN locations l ON e.location_id = l.location_id
WHERE em.user_id = $1
ORDER BY e.event_date;

-- Get all categories (for dropdown/filters)
SELECT * FROM categories
WHERE is_active = TRUE
ORDER BY category_name;

-- Get all locations (for dropdown/filters)
SELECT * FROM locations
WHERE is_active = TRUE
ORDER BY building_name, room_number;

-- Get featured/highlighted events
SELECT e.*, c.category_name, l.building_name
FROM events e
JOIN categories c ON e.category_id = c.category_id
JOIN locations l ON e.location_id = l.location_id
WHERE e.is_featured = TRUE 
  AND e.is_active = TRUE
  AND e.event_date >= CURRENT_DATE
ORDER BY e.event_date
LIMIT 5;

-- Get user by email (for login)
SELECT * FROM users
WHERE email = $1 AND is_active = TRUE;

-- Get unresolved event reports (for admins)
SELECT 
    er.*,
    e.title as event_title,
    u.first_name || ' ' || u.last_name as reported_by_name
FROM event_reports er
JOIN events e ON er.event_id = e.event_id
JOIN users u ON er.reported_by = u.user_id
WHERE er.resolved = FALSE
ORDER BY er.created_at DESC;

-- ============================================
-- END OF COMMON QUERIES
-- ============================================