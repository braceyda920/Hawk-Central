// ==================== IMPORTS ====================
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// ==================== APP SETUP ====================
const app = express();
app.use(cors());
app.use(express.json());

// ==================== EMAIL SETUP ====================
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'braceyda920@gmail.com',
    pass: 'pufmhasvjolswfpz',
  }
});

// ==================== DATABASE SETUP ====================
const pool = new Pool({
  user: 'treybracey',
  host: 'localhost',
  database: 'hawk_central',
  password: 'SecurePassword123!',
  port: 5432,
});

pool.connect()
  .then(() => console.log('✅ PostgreSQL connected'))
  .catch(err => console.error('❌ PostgreSQL connection error', err));

// ==================== HELPER ====================
async function canModifyEvent(userId, userRole, eventId) {
  if (userRole === 'super_admin') return true;
  const result = await pool.query('SELECT created_by FROM events WHERE event_id=$1', [eventId]);
  if (!result.rows[0]) return false;
  return result.rows[0].created_by === parseInt(userId);
}

// ==================== ROUTES ====================

app.get('/', (req, res) => res.send('🚀 Hawk Central Server is running'));

// ---------------- EVENTS --------------------

app.get('/events', async (req, res) => {
  try {
    const { category, search } = req.query;
    let query = `
      SELECT e.*,
             c.category_name, c.color as category_color,
             l.location_name, l.building_name,
             COUNT(ea.user_id) FILTER (WHERE ea.rsvp_status = 'attending') as rsvp_count
      FROM events e
      JOIN categories c ON e.category_id = c.category_id
      JOIN locations l ON e.location_id = l.location_id
      LEFT JOIN event_attendees ea ON e.event_id = ea.event_id
      WHERE e.is_active = TRUE AND e.is_public = TRUE
    `;
    const params = [];
    if (category) { params.push(`%${category}%`); query += ` AND c.category_name ILIKE $${params.length}`; }
    if (search) { params.push(`%${search}%`); query += ` AND (e.title ILIKE $${params.length} OR e.description ILIKE $${params.length})`; }
    query += ' GROUP BY e.event_id, c.category_name, c.color, l.location_name, l.building_name';
    query += ' ORDER BY e.event_date ASC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).send('Error fetching events'); }
});

app.get('/events/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.*, c.category_name, c.color as category_color, l.location_name, l.building_name,
              COUNT(ea.user_id) FILTER (WHERE ea.rsvp_status = 'attending') as rsvp_count
       FROM events e
       JOIN categories c ON e.category_id = c.category_id
       JOIN locations l ON e.location_id = l.location_id
       LEFT JOIN event_attendees ea ON e.event_id = ea.event_id
       WHERE e.event_id=$1
       GROUP BY e.event_id, c.category_name, c.color, l.location_name, l.building_name`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).send('Event not found');
    res.json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).send('Error fetching event'); }
});

app.post('/events', async (req, res) => {
  try {
    const { title, description, event_date, start_time, end_time, location_id, category_id, organizer_name, contact_email, max_capacity, created_by } = req.body;
    const result = await pool.query(
      `INSERT INTO events (title, description, event_date, start_time, end_time, location_id, category_id, organizer_name, contact_email, max_capacity, created_by, is_public, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,TRUE,TRUE) RETURNING *`,
      [title, description, event_date, start_time, end_time || null, location_id, category_id, organizer_name, contact_email || null, max_capacity || null, created_by]
    );
    res.json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).send('Error creating event'); }
});

app.put('/events/:id', async (req, res) => {
  try {
    const { user_id, user_role, title, description, event_date, start_time, end_time, location_id, category_id, organizer_name, contact_email, max_capacity } = req.body;
    const allowed = await canModifyEvent(user_id, user_role, req.params.id);
    if (!allowed) return res.status(403).send('You do not have permission to edit this event');
    const result = await pool.query(
      `UPDATE events SET title=$1, description=$2, event_date=$3, start_time=$4, end_time=$5,
       location_id=$6, category_id=$7, organizer_name=$8, contact_email=$9, max_capacity=$10
       WHERE event_id=$11 RETURNING *`,
      [title, description, event_date, start_time, end_time || null, location_id, category_id, organizer_name, contact_email || null, max_capacity || null, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).send('Error updating event'); }
});

app.delete('/events/:id', async (req, res) => {
  try {
    const { user_id, user_role } = req.body;
    const allowed = await canModifyEvent(user_id, user_role, req.params.id);
    if (!allowed) return res.status(403).send('You do not have permission to delete this event');
    await pool.query('DELETE FROM events WHERE event_id=$1', [req.params.id]);
    res.send('Event deleted');
  } catch (err) { console.error(err); res.status(500).send('Error deleting event'); }
});

// ---------------- CATEGORIES --------------------

app.get('/categories', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories WHERE is_active=TRUE');
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).send('Error fetching categories'); }
});

// ---------------- LOCATIONS --------------------

app.get('/locations', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM locations WHERE is_active=TRUE');
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).send('Error fetching locations'); }
});

// ---------------- RSVP --------------------

// Save / update RSVP
app.post('/rsvp', async (req, res) => {
  try {
    const { event_id, user_id, rsvp_status } = req.body;
    await pool.query(
      `INSERT INTO event_attendees (event_id, user_id, rsvp_status)
       VALUES ($1, $2, $3)
       ON CONFLICT (event_id, user_id) DO UPDATE SET rsvp_status=$3`,
      [event_id, user_id, rsvp_status]
    );
    const countResult = await pool.query(
      `SELECT COUNT(*) as rsvp_count FROM event_attendees WHERE event_id=$1 AND rsvp_status='attending'`,
      [event_id]
    );
    res.json({ success: true, rsvp_count: parseInt(countResult.rows[0].rsvp_count) });
  } catch (err) { console.error(err); res.status(500).send('Error saving RSVP'); }
});

// Cancel RSVP
app.delete('/rsvp', async (req, res) => {
  try {
    const { event_id, user_id } = req.body;
    await pool.query(
      'DELETE FROM event_attendees WHERE event_id=$1 AND user_id=$2',
      [event_id, user_id]
    );
    const countResult = await pool.query(
      `SELECT COUNT(*) as rsvp_count FROM event_attendees WHERE event_id=$1 AND rsvp_status='attending'`,
      [event_id]
    );
    res.json({ success: true, rsvp_count: parseInt(countResult.rows[0].rsvp_count) });
  } catch (err) { console.error(err); res.status(500).send('Error cancelling RSVP'); }
});

// Get all RSVPs for a specific user
app.get('/rsvp/user/:user_id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.*, c.category_name, l.location_name, ea.rsvp_status
       FROM event_attendees ea
       JOIN events e ON ea.event_id = e.event_id
       JOIN categories c ON e.category_id = c.category_id
       JOIN locations l ON e.location_id = l.location_id
       WHERE ea.user_id = $1 AND ea.rsvp_status = 'attending'
       ORDER BY e.event_date ASC`,
      [req.params.user_id]
    );
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).send('Error fetching user RSVPs'); }
});

// Get RSVP count for an event
app.get('/rsvp/:event_id/count', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) FROM event_attendees WHERE event_id=$1 AND rsvp_status='attending'`,
      [req.params.event_id]
    );
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (err) { console.error(err); res.status(500).send('Error fetching RSVP count'); }
});

// ---------------- SAVED EVENTS --------------------

app.post('/save', async (req, res) => {
  try {
    const { user_id, event_id } = req.body;
    await pool.query(
      `INSERT INTO saved_events (user_id, event_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [user_id, event_id]
    );
    res.send('Event saved');
  } catch (err) { console.error(err); res.status(500).send('Error saving event'); }
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
    res.json({ user_id: user.user_id, first_name: user.first_name, last_name: user.last_name, email: user.email, role: user.role });
  } catch (err) { console.error(err); res.status(500).send('Error logging in'); }
});

// ---------------- SIGNUP --------------------

app.post('/signup', async (req, res) => {
  try {
    const { email, password, first_name, last_name, student_id, major, graduation_year } = req.body;
    const existing = await pool.query('SELECT user_id FROM users WHERE email=$1', [email]);
    if (existing.rows.length > 0) return res.status(400).send('Email already registered');
    const password_hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, student_id, major, graduation_year)
       VALUES ($1,$2,$3,$4,'normal_user',$5,$6,$7)
       RETURNING user_id, email, first_name, last_name, role`,
      [email, password_hash, first_name, last_name, student_id || null, major || null, graduation_year || null]
    );
    res.json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).send('Error creating account'); }
});

// ---------------- PASSWORD RESET --------------------

app.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const userResult = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    if (userResult.rows.length === 0) return res.json({ message: 'If that email exists, a reset link has been sent.' });

    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 3600000);
    await pool.query('UPDATE users SET reset_token=$1, reset_token_expiry=$2 WHERE email=$3', [token, expiry, email]);

    const resetLink = `http://127.0.0.1:5500/Front-End/forgot-password.html?token=${token}`;
    await transporter.sendMail({
      from: '"Hawk Central" <braceyda920@gmail.com>',
      to: email,
      subject: 'Hawk Central — Reset Your Password',
      html: `
        <div style="font-family:sans-serif; max-width:480px; margin:0 auto;">
          <div style="background:#111111; padding:24px; border-radius:12px 12px 0 0; text-align:center;">
            <h1 style="color:#F5C518; margin:0; font-size:28px; letter-spacing:2px;">HAWK CENTRAL</h1>
            <p style="color:#888; margin:4px 0 0; font-size:13px;">Campus Events</p>
          </div>
          <div style="background:#ffffff; padding:32px; border-radius:0 0 12px 12px; border:1px solid #eee;">
            <h2 style="margin-bottom:8px;">Reset Your Password</h2>
            <p style="color:#666; margin-bottom:24px; line-height:1.5;">
              We received a request to reset your Hawk Central password.
              Click the button below to choose a new one. This link expires in <strong>1 hour</strong>.
            </p>
            <a href="${resetLink}" style="display:block; background:#F5C518; color:#111111; text-decoration:none; padding:16px; border-radius:10px; font-weight:700; text-align:center; font-size:16px;">
              Reset My Password
            </a>
            <p style="color:#aaa; font-size:12px; margin-top:24px; text-align:center;">
              If you didn't request a password reset, you can safely ignore this email.
            </p>
          </div>
        </div>
      `
    });

    console.log(`✅ Reset email sent to ${email}`);
    res.json({ message: 'Reset link sent!' });
  } catch (err) { console.error('❌ Email error:', err); res.status(500).send('Error sending reset email'); }
});

app.post('/reset-password', async (req, res) => {
  try {
    const { token, new_password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE reset_token=$1 AND reset_token_expiry > NOW()', [token]);
    if (result.rows.length === 0) return res.status(400).send('Invalid or expired reset token');
    const password_hash = await bcrypt.hash(new_password, 12);
    await pool.query('UPDATE users SET password_hash=$1, reset_token=NULL, reset_token_expiry=NULL WHERE user_id=$2', [password_hash, result.rows[0].user_id]);
    res.json({ message: 'Password reset successful' });
  } catch (err) { console.error(err); res.status(500).send('Error resetting password'); }
});

// ---------------- FEATURED --------------------

app.get('/featured', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.*, c.category_name, l.building_name FROM events e
       JOIN categories c ON e.category_id = c.category_id
       JOIN locations l ON e.location_id = l.location_id
       WHERE e.is_featured=TRUE AND e.is_active=TRUE`
    );
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).send('Error fetching featured events'); }
});

// ==================== START SERVER ====================
const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));