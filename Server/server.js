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

// File upload configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname)
  }
});
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// CORS
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

// ==================== EMAIL SETUP ====================
const resend = new Resend(process.env.RESEND_API_KEY);

// ==================== DATABASE SETUP ====================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://treybracey:SecurePassword123!@localhost:5432/hawk_central',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
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

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ---------------- FEATURED --------------------
app.get('/featured', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.*, c.category_name, l.building_name FROM events e
       LEFT JOIN categories c ON e.category_id = c.category_id
       LEFT JOIN locations l ON e.location_id = l.location_id
       WHERE e.is_featured=TRUE AND e.is_active=TRUE
       ORDER BY e.event_date ASC`
    );
    res.json(result.rows);
  } catch (err) { 
    console.error('Error fetching featured events:', err); 
    res.status(500).json({ error: 'Error fetching featured events' }); 
  }
});

// ==================== ROOT + FRONTEND FALLBACK ====================

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'Client', 'index.html'));
});

// ==================== ROOT ====================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../Client/index.html'));
});

// ==================== FRONTEND FALLBACK ====================
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../Client/index.html'));
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