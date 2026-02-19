// ==================== IMPORTS ====================
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const crypto = require('crypto'); // NEW: for password reset tokens

// ==================== APP SETUP ====================
const app = express();
app.use(cors());
app.use(express.json());

// ================== DATABASE SETUP ==================
const pool = new Pool({
  user: 'treybracey',         // <-- your Postgres username
  host: 'localhost',
  database: 'hawk_central',   // FIX: was 'hawk_central_db', now matches your actual DB name
  password: 'SecurePassword123!', // <-- your Postgres password
  port: 5432,
});

pool.connect()
  .then(() => console.log('✅ PostgreSQL connected'))
  .catch(err => console.error('❌ PostgreSQL connection error', err));


// ================== HELPER ====================
// Checks if the logged-in user owns the event OR is a super_admin
// Usage: call this before allowing edit/delete
async function canModifyEvent(userId, userRole, eventId) {
  if (userRole === 'super_admin') return true;
  const result = await pool.query(
    'SELECT created_by FROM events WHERE event_id=$1',
    [eventId]
  );
  if (!result.rows[0]) return false;
  return result.rows[0].created_by === userId;
}


// ================== ROUTES ==================

// Root route
app.get('/', (req, res) => {
  res.send('🚀 Hawk Central Server is running');
});

// ---------------- EVENTS --------------------

// Get all public events
// NEW: supports ?category=Sports&search=basketball filtering
app.get('/events', async (req, res) => {
  try {
    const { category, search } = req.query;

    let query = `
      SELECT e.*, c.category_name, c.color as category_color, l.location_name, l.building_name
      FROM events e
      JOIN categories c ON e.category_id = c.category_id
      JOIN locations l ON e.location_id = l.location_id
      WHERE e.is_active = TRUE AND e.is_public = TRUE
    `;
    const params = [];

    // Filter by category name if provided
    if (category) {
      params.push(category);
      query += ` AND c.category_name ILIKE $${params.length}`;
    }

    // Search by title or description if provided
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (e.title ILIKE $${params.length} OR e.description ILIKE $${params.length})`;
    }

    query += ' ORDER BY e.event_date ASC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching events');
  }
});

// Get single event by id
app.get('/events/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.*, c.category_name, c.color as category_color, l.location_name, l.building_name
       FROM events e
       JOIN categories c ON e.category_id = c.category_id
       JOIN locations l ON e.location_id = l.location_id
       WHERE e.event_id=$1`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).send('Event not found');
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching event');
  }
});

// Create new event
// Any logged-in user can create — created_by links it to them
app.post('/events', async (req, res) => {
  try {
    const {
      title, description, event_date, start_time, end_time,
      location_id, category_id, organizer_name, contact_email,
      max_capacity, created_by
    } = req.body;

    const result = await pool.query(
      `INSERT INTO events
        (title, description, event_date, start_time, end_time, location_id,
         category_id, organizer_name, contact_email, max_capacity, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [title, description, event_date, start_time, end_time, location_id,
       category_id, organizer_name, contact_email, max_capacity, created_by]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error creating event');
  }
});

// Edit event
// NEW: only the event owner OR super_admin can edit
app.put('/events/:id', async (req, res) => {
  try {
    const { user_id, user_role, title, description, event_date, start_time,
            end_time, location_id, category_id, organizer_name, contact_email, max_capacity } = req.body;

    const allowed = await canModifyEvent(user_id, user_role, req.params.id);
    if (!allowed) return res.status(403).send('You do not have permission to edit this event');

    const result = await pool.query(
      `UPDATE events SET
        title=$1, description=$2, event_date=$3, start_time=$4, end_time=$5,
        location_id=$6, category_id=$7, organizer_name=$8, contact_email=$9, max_capacity=$10
       WHERE event_id=$11
       RETURNING *`,
      [title, description, event_date, start_time, end_time,
       location_id, category_id, organizer_name, contact_email, max_capacity, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error updating event');
  }
});

// Delete event
// NEW: only the event owner OR super_admin can delete
app.delete('/events/:id', async (req, res) => {
  try {
    const { user_id, user_role } = req.body;

    const allowed = await canModifyEvent(user_id, user_role, req.params.id);
    if (!allowed) return res.status(403).send('You do not have permission to delete this event');

    await pool.query('DELETE FROM events WHERE event_id=$1', [req.params.id]);
    res.send('Event deleted');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error deleting event');
  }
});

// ---------------- CATEGORIES --------------------

app.get('/categories', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories WHERE is_active=TRUE');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching categories');
  }
});

// ---------------- LOCATIONS --------------------

app.get('/locations', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM locations WHERE is_active=TRUE');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching locations');
  }
});

// ---------------- SEARCH --------------------
// NOTE: search is now built into GET /events?search=keyword
// Keeping this route so nothing breaks if it's already being called
app.get('/search/:keyword', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.*, c.category_name, l.building_name
       FROM events e
       JOIN categories c ON e.category_id = c.category_id
       JOIN locations l ON e.location_id = l.location_id
       WHERE e.title ILIKE '%' || $1 || '%'
       AND e.is_active=TRUE`,
      [req.params.keyword]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error searching events');
  }
});

// ---------------- RSVP --------------------

app.post('/rsvp', async (req, res) => {
  try {
    const { event_id, user_id, rsvp_status } = req.body;
    await pool.query(
      `INSERT INTO event_attendees (event_id, user_id, rsvp_status)
       VALUES ($1, $2, $3)
       ON CONFLICT (event_id, user_id)
       DO UPDATE SET rsvp_status=$3`,
      [event_id, user_id, rsvp_status]
    );
    res.send('RSVP saved');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error saving RSVP');
  }
});

// Get RSVP count for an event (useful for displaying on event cards)
app.get('/rsvp/:event_id/count', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) FROM event_attendees
       WHERE event_id=$1 AND rsvp_status='attending'`,
      [req.params.event_id]
    );
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching RSVP count');
  }
});

// ---------------- SAVED EVENTS --------------------

app.post('/save', async (req, res) => {
  try {
    const { user_id, event_id } = req.body;
    await pool.query(
      `INSERT INTO saved_events (user_id, event_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [user_id, event_id]
    );
    res.send('Event saved');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error saving event');
  }
});

// ---------------- LOGIN --------------------

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE email=$1', [email]);

    if (result.rows.length === 0) return res.status(401).send('User not found');

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) return res.status(401).send('Incorrect password');

    // Return user info — role will be 'normal_user' or 'super_admin'
    res.json({
      user_id: user.user_id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      role: user.role
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error logging in');
  }
});

// ---------------- SIGNUP --------------------

app.post('/signup', async (req, res) => {
  try {
    const { email, password, first_name, last_name, student_id, major, graduation_year } = req.body;

    // Check if email already exists
    const existing = await pool.query('SELECT user_id FROM users WHERE email=$1', [email]);
    if (existing.rows.length > 0) return res.status(400).send('Email already registered');

    const password_hash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, student_id, major, graduation_year)
       VALUES ($1, $2, $3, $4, 'normal_user', $5, $6, $7)
       RETURNING user_id, email, first_name, last_name, role`,
      [email, password_hash, first_name, last_name, student_id, major, graduation_year]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error creating account');
  }
});

// ---------------- PASSWORD RESET --------------------
// NEW: Replaces the IT Admin group role

// Step 1: Request a reset token (in production this would email the link)
app.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 3600000); // token valid for 1 hour

    await pool.query(
      'UPDATE users SET reset_token=$1, reset_token_expiry=$2 WHERE email=$3',
      [token, expiry, email]
    );

    // TODO: Send email with link like: http://localhost:3000/reset-password?token=TOKEN
    // For now, returning token directly so you can test it
    console.log(`🔑 Reset token for ${email}: ${token}`);
    res.json({ message: 'Reset token generated', token }); // remove token from response in production
  } catch (err) {
    console.error(err);
    res.status(500).send('Error generating reset token');
  }
});

// Step 2: Use the token to set a new password
app.post('/reset-password', async (req, res) => {
  try {
    const { token, new_password } = req.body;

    const result = await pool.query(
      'SELECT * FROM users WHERE reset_token=$1 AND reset_token_expiry > NOW()',
      [token]
    );

    if (result.rows.length === 0) return res.status(400).send('Invalid or expired reset token');

    const password_hash = await bcrypt.hash(new_password, 12);

    await pool.query(
      'UPDATE users SET password_hash=$1, reset_token=NULL, reset_token_expiry=NULL WHERE user_id=$2',
      [password_hash, result.rows[0].user_id]
    );

    res.send('Password reset successful');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error resetting password');
  }
});

// ---------------- FEATURED --------------------

app.get('/featured', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.*, c.category_name, l.building_name
       FROM events e
       JOIN categories c ON e.category_id = c.category_id
       JOIN locations l ON e.location_id = l.location_id
       WHERE e.is_featured=TRUE AND e.is_active=TRUE`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching featured events');
  }
});

// ================== START SERVER ==================

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
