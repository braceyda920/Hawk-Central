// ==================== IMPORTS ====================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { Resend } = require('resend');
const multer = require('multer');
const path = require('path');

// ==================== APP SETUP ====================
const app = express();

const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, 'uploads/') },
  filename: function (req, file, cb) { cb(null, Date.now() + '-' + file.originalname) }
});
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) return cb(null, true);
    else cb(new Error('Only image files are allowed!'));
  }
});

app.use(cors({
  origin: [
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    process.env.FRONTEND_URL || 'https://hawk-central-production.up.railway.app'
  ],
  credentials: true
}));

app.use(express.json());
app.use('/uploads', express.static('uploads'));
app.use(express.static(path.join(__dirname, 'Client')));

const resend = new Resend(process.env.RESEND_API_KEY);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://treybracey:SecurePassword123!@localhost:5432/hawk_central',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.connect()
  .then(() => console.log('✅ PostgreSQL connected'))
  .catch(err => console.error('❌ PostgreSQL connection error', err));

// Ensure reset token columns exist on startup
pool.query(`
  ALTER TABLE users
  ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255),
  ADD COLUMN IF NOT EXISTS reset_token_expiry TIMESTAMP
`).then(() => console.log('✅ Reset token columns verified'))
  .catch(err => console.error('⚠️ Could not verify reset token columns:', err));

async function canModifyEvent(userId, userRole, eventId) {
  if (userRole === 'super_admin') return true;
  const result = await pool.query('SELECT created_by FROM events WHERE event_id=$1', [eventId]);
  if (!result.rows[0]) return false;
  return parseInt(result.rows[0].created_by) === parseInt(userId);
}

// ==================== ROUTES ====================

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// EVENTS
app.get('/events', async (req, res) => {
  try {
    const { category, search } = req.query;
    let query = `
      SELECT e.*, c.category_name, c.color as category_color, l.location_name, l.building_name,
             COUNT(DISTINCT ea.user_id) FILTER (WHERE ea.rsvp_status = 'attending') as rsvp_count,
             COUNT(DISTINCT ec.comment_id) as comment_count,
             COUNT(DISTINCT ep.photo_id) as photo_count
      FROM events e
      LEFT JOIN categories c ON e.category_id = c.category_id
      LEFT JOIN locations l ON e.location_id = l.location_id
      LEFT JOIN event_attendees ea ON e.event_id = ea.event_id
      LEFT JOIN event_comments ec ON e.event_id = ec.event_id
      LEFT JOIN event_photos ep ON e.event_id = ep.event_id
      WHERE e.is_active = TRUE AND e.is_public = TRUE
    `;
    const params = [];
    if (category) { params.push(`%${category}%`); query += ` AND c.category_name ILIKE $${params.length}`; }
    if (search) { params.push(`%${search}%`); query += ` AND (e.title ILIKE $${params.length} OR e.description ILIKE $${params.length})`; }
    query += ' GROUP BY e.event_id, c.category_name, c.color, l.location_name, l.building_name ORDER BY e.event_date ASC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error fetching events' }); }
});

app.get('/events/mine/:user_id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.*, c.category_name, c.color as category_color, l.location_name, l.building_name,
              COUNT(DISTINCT ea.user_id) FILTER (WHERE ea.rsvp_status = 'attending') as rsvp_count
       FROM events e
       LEFT JOIN categories c ON e.category_id = c.category_id
       LEFT JOIN locations l ON e.location_id = l.location_id
       LEFT JOIN event_attendees ea ON e.event_id = ea.event_id
       WHERE e.created_by = $1
       GROUP BY e.event_id, c.category_name, c.color, l.location_name, l.building_name
       ORDER BY e.event_date ASC`,
      [req.params.user_id]
    );
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error fetching user events' }); }
});

app.get('/events/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.*, c.category_name, c.color as category_color, l.location_name, l.building_name,
              COUNT(DISTINCT ea.user_id) FILTER (WHERE ea.rsvp_status = 'attending') as rsvp_count,
              COUNT(DISTINCT ec.comment_id) as comment_count,
              COUNT(DISTINCT ep.photo_id) as photo_count
       FROM events e
       LEFT JOIN categories c ON e.category_id = c.category_id
       LEFT JOIN locations l ON e.location_id = l.location_id
       LEFT JOIN event_attendees ea ON e.event_id = ea.event_id
       LEFT JOIN event_comments ec ON e.event_id = ec.event_id
       LEFT JOIN event_photos ep ON e.event_id = ep.event_id
       WHERE e.event_id=$1
       GROUP BY e.event_id, c.category_name, c.color, l.location_name, l.building_name`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Event not found' });
    res.json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error fetching event' }); }
});

app.post('/events', async (req, res) => {
  try {
    const { title, description, event_date, start_time, end_time, location_name, building_name,
            category_name, organizer_name, contact_email, max_capacity, created_by, category_id, location_id } = req.body;
    if (!title || !event_date || !created_by) return res.status(400).json({ error: 'Missing required fields' });
    let cat_id = category_id;
    if (!cat_id && category_name) {
      let catResult = await pool.query('SELECT category_id FROM categories WHERE LOWER(category_name) = LOWER($1)', [category_name]);
      if (catResult.rows.length === 0) catResult = await pool.query('INSERT INTO categories (category_name, is_active) VALUES ($1, TRUE) RETURNING category_id', [category_name]);
      cat_id = catResult.rows[0].category_id;
    }
    let loc_id = location_id;
    if (!loc_id && (location_name || building_name)) {
      let locResult = await pool.query('SELECT location_id FROM locations WHERE LOWER(location_name) = LOWER($1) OR LOWER(building_name) = LOWER($2)', [location_name || '', building_name || '']);
      if (locResult.rows.length === 0) locResult = await pool.query('INSERT INTO locations (location_name, building_name, is_active) VALUES ($1, $2, TRUE) RETURNING location_id', [location_name || building_name, building_name || location_name]);
      loc_id = locResult.rows[0].location_id;
    }
    const result = await pool.query(
      `INSERT INTO events (title, description, event_date, start_time, end_time, location_id, category_id, organizer_name, contact_email, max_capacity, created_by, is_public, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,TRUE,TRUE) RETURNING *`,
      [title, description, event_date, start_time, end_time || null, loc_id, cat_id, organizer_name, contact_email || null, max_capacity || null, created_by]
    );
    res.json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error creating event' }); }
});

app.put('/events/:id', async (req, res) => {
  try {
    const { user_id, user_role, title, description, event_date, start_time, end_time,
            location_name, building_name, category_name, organizer_name, contact_email,
            max_capacity, category_id, location_id, is_archived } = req.body;
    const allowed = await canModifyEvent(user_id, user_role, req.params.id);
    if (!allowed) return res.status(403).json({ error: 'You do not have permission to edit this event' });

    // Archive/unarchive only
    if (is_archived !== undefined && !title) {
      const result = await pool.query('UPDATE events SET is_active=$1 WHERE event_id=$2 RETURNING *', [!is_archived, req.params.id]);
      return res.json(result.rows[0]);
    }

    let cat_id = category_id;
    if (!cat_id && category_name) {
      let catResult = await pool.query('SELECT category_id FROM categories WHERE LOWER(category_name) = LOWER($1)', [category_name]);
      if (catResult.rows.length === 0) catResult = await pool.query('INSERT INTO categories (category_name, is_active) VALUES ($1, TRUE) RETURNING category_id', [category_name]);
      cat_id = catResult.rows[0].category_id;
    }
    let loc_id = location_id;
    if (!loc_id && (location_name || building_name)) {
      let locResult = await pool.query('SELECT location_id FROM locations WHERE LOWER(location_name) = LOWER($1) OR LOWER(building_name) = LOWER($2)', [location_name || '', building_name || '']);
      if (locResult.rows.length === 0) locResult = await pool.query('INSERT INTO locations (location_name, building_name, is_active) VALUES ($1, $2, TRUE) RETURNING location_id', [location_name || building_name, building_name || location_name]);
      loc_id = locResult.rows[0].location_id;
    }
    const result = await pool.query(
      `UPDATE events SET title=$1, description=$2, event_date=$3, start_time=$4, end_time=$5,
       location_id=$6, category_id=$7, organizer_name=$8, contact_email=$9, max_capacity=$10
       WHERE event_id=$11 RETURNING *`,
      [title, description, event_date, start_time, end_time || null, loc_id, cat_id, organizer_name, contact_email || null, max_capacity || null, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error updating event' }); }
});

app.delete('/events/:id', async (req, res) => {
  try {
    const user_id = req.query.user_id || req.body.user_id;
    const user_role = req.query.user_role || req.body.user_role;
    const allowed = await canModifyEvent(user_id, user_role, req.params.id);
    if (!allowed) return res.status(403).json({ error: 'You do not have permission to delete this event' });
    const eid = req.params.id;
    await pool.query('DELETE FROM event_attendees WHERE event_id=$1', [eid]);
    await pool.query('DELETE FROM saved_events WHERE event_id=$1', [eid]);
    await pool.query('DELETE FROM event_comments WHERE event_id=$1', [eid]);
    await pool.query('DELETE FROM event_photos WHERE event_id=$1', [eid]);
    await pool.query('DELETE FROM events WHERE event_id=$1', [eid]);
    res.json({ message: 'Event deleted successfully' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error deleting event' }); }
});

// CATEGORIES
app.get('/categories', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories WHERE is_active=TRUE ORDER BY category_name');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Error fetching categories' }); }
});

app.get('/categories/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);
    const result = await pool.query('SELECT * FROM categories WHERE category_name ILIKE $1 AND is_active=TRUE ORDER BY category_name LIMIT 10', [`%${q}%`]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Error searching categories' }); }
});

// LOCATIONS
app.get('/locations', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM locations WHERE is_active=TRUE ORDER BY building_name');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Error fetching locations' }); }
});

app.get('/locations/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);
    const result = await pool.query('SELECT * FROM locations WHERE (location_name ILIKE $1 OR building_name ILIKE $1) AND is_active=TRUE ORDER BY building_name LIMIT 10', [`%${q}%`]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Error searching locations' }); }
});

// COMMENTS
app.get('/events/:event_id/comments', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ec.*, u.first_name, u.last_name, u.email FROM event_comments ec
       JOIN users u ON ec.user_id = u.user_id WHERE ec.event_id = $1 ORDER BY ec.created_at DESC`,
      [req.params.event_id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Error fetching comments' }); }
});

app.post('/events/:event_id/comments', async (req, res) => {
  try {
    const { user_id, comment_text } = req.body;
    if (!user_id || !comment_text) return res.status(400).json({ error: 'Missing required fields' });
    const result = await pool.query(
      'INSERT INTO event_comments (event_id, user_id, comment_text, created_at) VALUES ($1, $2, $3, NOW()) RETURNING *',
      [req.params.event_id, user_id, comment_text]
    );
    const userResult = await pool.query('SELECT first_name, last_name FROM users WHERE user_id = $1', [user_id]);
    res.json({ ...result.rows[0], first_name: userResult.rows[0].first_name, last_name: userResult.rows[0].last_name });
  } catch (err) { res.status(500).json({ error: 'Error adding comment' }); }
});

app.delete('/comments/:comment_id', async (req, res) => {
  try {
    const { user_id, user_role } = req.body;
    const commentResult = await pool.query('SELECT user_id FROM event_comments WHERE comment_id = $1', [req.params.comment_id]);
    if (commentResult.rows.length === 0) return res.status(404).json({ error: 'Comment not found' });
    const isOwner = commentResult.rows[0].user_id === parseInt(user_id);
    const isAdmin = user_role === 'super_admin' || user_role === 'it_admin';
    if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Not authorized' });
    await pool.query('DELETE FROM event_comments WHERE comment_id = $1', [req.params.comment_id]);
    res.json({ message: 'Comment deleted' });
  } catch (err) { res.status(500).json({ error: 'Error deleting comment' }); }
});

// PHOTOS
app.get('/events/:event_id/photos', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ep.*, u.first_name, u.last_name FROM event_photos ep
       JOIN users u ON ep.uploaded_by = u.user_id WHERE ep.event_id = $1 ORDER BY ep.uploaded_at DESC`,
      [req.params.event_id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Error fetching photos' }); }
});

app.post('/events/:event_id/photos', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const photo_url = `/uploads/${req.file.filename}`;
    const result = await pool.query(
      'INSERT INTO event_photos (event_id, uploaded_by, photo_url, caption, uploaded_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING *',
      [req.params.event_id, req.body.user_id, photo_url, req.body.caption || null]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Error uploading photo' }); }
});

app.delete('/photos/:photo_id', async (req, res) => {
  try {
    const { user_id, user_role } = req.body;
    const photoResult = await pool.query('SELECT uploaded_by FROM event_photos WHERE photo_id = $1', [req.params.photo_id]);
    if (photoResult.rows.length === 0) return res.status(404).json({ error: 'Photo not found' });
    const isOwner = photoResult.rows[0].uploaded_by === parseInt(user_id);
    const isAdmin = user_role === 'super_admin' || user_role === 'it_admin';
    if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Not authorized' });
    await pool.query('DELETE FROM event_photos WHERE photo_id = $1', [req.params.photo_id]);
    res.json({ message: 'Photo deleted' });
  } catch (err) { res.status(500).json({ error: 'Error deleting photo' }); }
});

// RSVP
app.post('/rsvp', async (req, res) => {
  try {
    const { event_id, user_id, rsvp_status } = req.body;
    if (!event_id || !user_id || !rsvp_status) return res.status(400).json({ error: 'Missing required fields' });
    await pool.query(
      'INSERT INTO event_attendees (event_id, user_id, rsvp_status) VALUES ($1, $2, $3) ON CONFLICT (event_id, user_id) DO UPDATE SET rsvp_status=$3',
      [event_id, user_id, rsvp_status]
    );
    const countResult = await pool.query("SELECT COUNT(*) as rsvp_count FROM event_attendees WHERE event_id=$1 AND rsvp_status='attending'", [event_id]);
    res.json({ success: true, rsvp_count: parseInt(countResult.rows[0].rsvp_count) });
  } catch (err) { res.status(500).json({ error: 'Error saving RSVP' }); }
});

app.delete('/rsvp', async (req, res) => {
  try {
    const event_id = req.query.event_id || req.body.event_id;
    const user_id = req.query.user_id || req.body.user_id;
    await pool.query('DELETE FROM event_attendees WHERE event_id=$1 AND user_id=$2', [event_id, user_id]);
    const countResult = await pool.query("SELECT COUNT(*) as rsvp_count FROM event_attendees WHERE event_id=$1 AND rsvp_status='attending'", [event_id]);
    res.json({ success: true, rsvp_count: parseInt(countResult.rows[0].rsvp_count) });
  } catch (err) { res.status(500).json({ error: 'Error cancelling RSVP' }); }
});

app.get('/rsvp/user/:user_id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.*, c.category_name, l.location_name, ea.rsvp_status FROM event_attendees ea
       JOIN events e ON ea.event_id = e.event_id
       LEFT JOIN categories c ON e.category_id = c.category_id
       LEFT JOIN locations l ON e.location_id = l.location_id
       WHERE ea.user_id = $1 AND ea.rsvp_status = 'attending' ORDER BY e.event_date ASC`,
      [req.params.user_id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Error fetching user RSVPs' }); }
});

app.get('/rsvp/:event_id/count', async (req, res) => {
  try {
    const result = await pool.query("SELECT COUNT(*) FROM event_attendees WHERE event_id=$1 AND rsvp_status='attending'", [req.params.event_id]);
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (err) { res.status(500).json({ error: 'Error fetching RSVP count' }); }
});

// SAVED EVENTS
app.post('/save', async (req, res) => {
  try {
    const { user_id, event_id } = req.body;
    await pool.query('INSERT INTO saved_events (user_id, event_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [user_id, event_id]);
    res.json({ message: 'Event saved successfully' });
  } catch (err) { res.status(500).json({ error: 'Error saving event' }); }
});

app.get('/saved/user/:user_id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.*, c.category_name, l.location_name FROM saved_events se
       JOIN events e ON se.event_id = e.event_id
       LEFT JOIN categories c ON e.category_id = c.category_id
       LEFT JOIN locations l ON e.location_id = l.location_id
       WHERE se.user_id = $1 AND e.is_active = TRUE ORDER BY e.event_date ASC`,
      [req.params.user_id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Error fetching saved events' }); }
});

app.delete('/save/:event_id', async (req, res) => {
  try {
    const { user_id } = req.body;
    await pool.query('DELETE FROM saved_events WHERE user_id=$1 AND event_id=$2', [user_id, req.params.event_id]);
    res.json({ message: 'Event unsaved successfully' });
  } catch (err) { res.status(500).json({ error: 'Error unsaving event' }); }
});

// AUTH
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const result = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'User not found' });
    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Incorrect password' });
    res.json({ user_id: user.user_id, first_name: user.first_name, last_name: user.last_name, email: user.email, role: user.role });
  } catch (err) { res.status(500).json({ error: 'Error logging in' }); }
});

app.post('/signup', async (req, res) => {
  try {
    const { email, password, first_name, last_name, student_id, major, graduation_year } = req.body;
    if (!email || !password || !first_name || !last_name) return res.status(400).json({ error: 'Missing required fields' });
    const existing = await pool.query('SELECT user_id FROM users WHERE email=$1', [email]);
    if (existing.rows.length > 0) return res.status(400).json({ error: 'Email already registered' });
    const password_hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      "INSERT INTO users (email, password_hash, first_name, last_name, role, student_id, major, graduation_year) VALUES ($1,$2,$3,$4,'normal_user',$5,$6,$7) RETURNING user_id, email, first_name, last_name, role",
      [email, password_hash, first_name, last_name, student_id || null, major || null, graduation_year || null]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Error creating account' }); }
});

app.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    console.log("📩 Forgot password request for:", email);

    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: 'Invalid email' });
    }

    const userResult = await pool.query('SELECT * FROM users WHERE email=$1', [email]);

    // Always return the same message to prevent email enumeration
    if (userResult.rows.length === 0) {
      return res.json({ message: 'If that email exists, a reset link has been sent.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 3600000);

    await pool.query(
      'UPDATE users SET reset_token=$1, reset_token_expiry=$2 WHERE email=$3',
      [token, expiry, email]
    );

    const frontendURL = process.env.FRONTEND_URL || 'https://hawk-central-production.up.railway.app';
    const resetLink = `${frontendURL}/forgot-password.html?token=${token}`;
    console.log("🔗 Reset link:", resetLink);

    // Fire-and-forget — don't block the response waiting for email
    resend.emails.send({
      from: 'noreply@hawkcentral.it.com',
      to: email,
      subject: 'Hawk Central — Reset Your Password',
      html: `<p>Click here to reset your password:</p><a href="${resetLink}">${resetLink}</a>`
    }).then(r => console.log("✅ Email sent:", r))
      .catch(e => console.error("❌ Email send error:", e));

    // Respond immediately without waiting for email
    res.json({ message: 'If that email exists, a reset link has been sent.' });

  } catch (err) {
    console.error('❌ ROUTE ERROR:', err);
    res.status(500).json({ error: 'Error sending reset email' });
  }
});

// RESET PASSWORD
app.post('/reset-password', async (req, res) => {
  try {
    const { token, new_password: password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Missing token or password' });

    const result = await pool.query(
      'SELECT * FROM users WHERE reset_token=$1 AND reset_token_expiry > NOW()',
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const password_hash = await bcrypt.hash(password, 12);

    await pool.query(
      'UPDATE users SET password_hash=$1, reset_token=NULL, reset_token_expiry=NULL WHERE reset_token=$2',
      [password_hash, token]
    );

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error resetting password' });
  }
});

// FEATURED
app.get('/featured', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.*, c.category_name, l.building_name FROM events e
       LEFT JOIN categories c ON e.category_id = c.category_id
       LEFT JOIN locations l ON e.location_id = l.location_id
       WHERE e.is_featured=TRUE AND e.is_active=TRUE ORDER BY e.event_date ASC`
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Error fetching featured events' }); }
});

// ==================== ERROR HANDLING ====================
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// ==================== START SERVER ====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
