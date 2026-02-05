const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'hawk_central_db',
  password: 'SecurePassword123!',  // Use your actual password
  port: 5432,
});

app.get('/', (req, res) => {
  res.send('Hawk Central Server is running');
});


// ================== EVENTS ======================


// Get all public events
app.get('/events', async (req, res) => {
  const result = await pool.query(`
    SELECT e.*, c.category_name, l.building_name
    FROM events e
    JOIN categories c ON e.category_id = c.category_id
    JOIN locations l ON e.location_id = l.location_id
    WHERE e.is_active = TRUE
    ORDER BY e.event_date;
  `);
  res.json(result.rows);
});


// Get single event
app.get('/events/:id', async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM events WHERE event_id=$1',
    [req.params.id]
  );
  res.json(result.rows[0]);
});


// Create new event
app.post('/events', async (req, res) => {
  const { title, description, event_date, start_time, location_id, category_id, organizer_name, created_by} = req.body;

  const result = await pool.query(
    `INSERT INTO events
    (title, description, event_date, start_time, location_id, category_id, organizer_name, created_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
    RETURNING *`,
    [title, description, event_date, start_time, location_id, category_id, organizer_name, created_by]
  );

  res.json(result.rows[0]);
});

// Delete event
app.delete('/events/:id', async (req, res) => {
  await pool.query('DELETE FROM events WHERE event_id=$1', [req.params.id]);
  res.send('Deleted');
});


// ================== CATEGORIES ==================


app.get('/categories', async (req, res) => {
  const result = await pool.query('SELECT * FROM categories WHERE is_active=TRUE');
  res.json(result.rows);
});


// ================== LOCATIONS ===================


app.get('/locations', async (req, res) => {
  const result = await pool.query('SELECT * FROM locations WHERE is_active=TRUE');
  res.json(result.rows);
});


// ================== SEARCH =======================


app.get('/search/:keyword', async (req, res) => {
  const result = await pool.query(
    `SELECT * FROM events
     WHERE title ILIKE '%' || $1 || '%'
     AND is_active=TRUE`,
    [req.params.keyword]
  );
  res.json(result.rows);
});


// ================= RSVP ==========================


app.post('/rsvp', async (req, res) => {
  const { event_id, user_id, rsvp_status } = req.body;

  await pool.query(
    `INSERT INTO event_attendees (event_id, user_id, rsvp_status)
     VALUES ($1, $2, $3)
     ON CONFLICT (event_id, user_id)
     DO UPDATE SET rsvp_status=$3`,
    [event_id, user_id, rsvp_status]
  );

  res.send('RSVP Saved');
});


// ================= SAVED EVENTS ==================


app.post('/save', async (req, res) => {
  const { user_id, event_id } = req.body;

  await pool.query(
    `INSERT INTO saved_events (user_id, event_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [user_id, event_id]
  );

  res.send('Saved');
});


// ================= LOGIN =========================

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const result = await pool.query(
    'SELECT * FROM users WHERE email=$1',
    [email]
  );

  if (result.rows.length === 0) return res.status(401).send('User not found');

  const user = result.rows[0];
  const match = await bcrypt.compare(password, user.password_hash);

  if (!match) return res.status(401).send('Incorrect password');

  res.json({ user_id: user.user_id, role: user.role });
});


// ============== FEATURED ========================

app.get('/featured', async (req, res) => {
  const result = await pool.query(
    `SELECT * FROM events
     WHERE is_featured=TRUE AND is_active=TRUE`
  );
  res.json(result.rows);
});


// ============== SERVER =========================

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
