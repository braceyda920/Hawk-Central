// ==================== IMPORTS ====================
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

// ==================== APP SETUP ====================
const app = express();
app.use(cors());
app.use(express.json());

// ================== DATABASE SETUP ==================
const pool = new Pool({
  user: 'treybracey',       // <-- your Postgres username
  host: 'localhost',
  database: 'hawk_central_db', // <-- your database name
  password: 'SecurePassword123!', // <-- your Postgres password
  port: 5432,
});

pool.connect()
  .then(() => console.log('✅ PostgreSQL connected'))
  .catch(err => console.error('❌ PostgreSQL connection error', err));

// ================== ROUTES ==================

// Root route
app.get('/', (req, res) => {
  res.send('🚀 Hawk Central Server is running');
});

// ---------------- EVENTS --------------------

// Get all public events
app.get('/events', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT e.*, c.category_name, l.building_name
      FROM events e
      JOIN categories c ON e.category_id = c.category_id
      JOIN locations l ON e.location_id = l.location_id
      WHERE e.is_active = TRUE
      ORDER BY e.event_date;
    `);
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
      'SELECT * FROM events WHERE event_id=$1',
      [req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching event');
  }
});

// Create new event
app.post('/events', async (req, res) => {
  try {
    const { title, description, event_date, start_time, location_id, category_id, organizer_name, created_by } = req.body;
    const result = await pool.query(
      `INSERT INTO events
        (title, description, event_date, start_time, location_id, category_id, organizer_name, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [title, description, event_date, start_time, location_id, category_id, organizer_name, created_by]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error creating event');
  }
});

// Delete event
app.delete('/events/:id', async (req, res) => {
  try {
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

app.get('/search/:keyword', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM events
       WHERE title ILIKE '%' || $1 || '%'
       AND is_active=TRUE`,
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

    res.json({ user_id: user.user_id, role: user.role });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error logging in');
  }
});

// ---------------- FEATURED --------------------

app.get('/featured', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM events WHERE is_featured=TRUE AND is_active=TRUE');
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
