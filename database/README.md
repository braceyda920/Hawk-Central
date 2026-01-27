# Database Setup Guide

## Overview

PostgreSQL database with 10 interconnected tables for the Hawk Central campus event management platform.

## Database Information

- **Database Name:** `hawk_central_db`
- **Total Tables:** 10
- **Sample Data:** 4 users, 5 categories, 5 locations, 3 events

## Tables

1. **users** - User accounts (students, faculty, staff, admins)
2. **events** - Campus events
3. **categories** - Event categories (Sports, Academic, Social, etc.)
4. **locations** - Campus venues
5. **event_attendees** - RSVP tracking (Level 2 feature)
6. **event_moderators** - Event co-managers
7. **event_reports** - Spam/abuse reports
8. **saved_events** - Bookmarked events (Level 2 feature)
9. **notification_preferences** - Email notification settings (Level 2 feature)
10. **password_reset_tokens** - Password recovery tokens

## Quick Setup

### 1. Install PostgreSQL

**Mac:**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Windows:**
Download from https://www.postgresql.org/download/windows/

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### 2. Create Database
```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE hawk_central_db;

# Exit
\q
```

### 3. Run Schema

Navigate to the project root and run:
```bash
psql -U postgres -d hawk_central_db -f database/schema/create_tables.sql
```

This creates all 10 tables with proper relationships.

### 4. Insert Sample Data
```bash
psql -U postgres -d hawk_central_db -f database/seeds/insert_sample_data.sql
```

This inserts:
- 4 users (Alice, Marcus, Sarah, Dr. Martinez)
- 5 categories (Sports, Academic, Social, Clubs, Career)
- 5 locations (Student Center, Sports Arena, Library, etc.)
- 3 events (Basketball game, Study group, Career fair)

### 5. Verify Setup
```bash
# Connect to database
psql -U postgres -d hawk_central_db

# Check tables exist
\dt

# Check sample data
SELECT COUNT(*) FROM users;       -- Should return 4
SELECT COUNT(*) FROM events;      -- Should return 3
SELECT COUNT(*) FROM categories;  -- Should return 5
SELECT COUNT(*) FROM locations;   -- Should return 5

# View all events with details
SELECT e.title, u.first_name, c.category_name, l.building_name 
FROM events e
JOIN users u ON e.created_by = u.user_id
JOIN categories c ON e.category_id = c.category_id
JOIN locations l ON e.location_id = l.location_id;

# Exit
\q
```

## Connection Information

**For Backend Development (Node.js):**
```javascript
const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'hawk_central_db',
  password: 'your_password',  // Use your actual password
  port: 5432,
});

// Example query
pool.query('SELECT * FROM events', (err, res) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Events:', res.rows);
  }
});
```

## Common Queries

See `queries/common_queries.sql` for frequently used SQL queries including:
- Get all public events
- Search events by keyword
- Get events by category/location
- Count RSVPs for an event
- Get user's created/saved events
- And more...

## Database Schema Overview

### Core Tables
- **users** - All user accounts with role-based permissions
- **categories** - Event types (reusable)
- **locations** - Campus venues (reusable)
- **events** - Main event data with foreign keys to users, categories, locations

### Interaction Tables (Level 2)
- **event_attendees** - Many-to-many: users can RSVP to multiple events
- **event_moderators** - Many-to-many: users can moderate multiple events
- **saved_events** - Many-to-many: users can save multiple events
- **event_reports** - Track inappropriate event reports

### Support Tables
- **notification_preferences** - One-to-one: each user has one preferences record
- **password_reset_tokens** - Temporary tokens for password recovery

### Relationships
All tables are connected through foreign keys:
- Users **create** Events (`events.created_by → users.user_id`)
- Events **belong to** Categories (`events.category_id → categories.category_id`)
- Events **occur at** Locations (`events.location_id → locations.location_id`)
- Users **RSVP to** Events (via `event_attendees`)
- Users **moderate** Events (via `event_moderators`)
- Users **save** Events (via `saved_events`)

## Sample Users

**For testing the application:**

| Email | Password | Role | Description |
|-------|----------|------|-------------|
| alice.johnson@hawk.edu | Password123 | normal_user | Biology student, creates study groups |
| marcus.williams@hawk.edu | Password123 | normal_user | Communications student, active event creator |
| itadmin@hawk.edu | Password123 | it_admin | IT support, manages user accounts |
| admin@hawk.edu | Password123 | super_admin | Full system access |

**Note:** All passwords are hashed with bcrypt. The plain text password for testing is "Password123"

## Troubleshooting

**"relation does not exist" error:**
- Make sure you ran `create_tables.sql` before `insert_sample_data.sql`
- Check you're connected to the correct database

**"duplicate key value" error:**
- Sample data already inserted
- Run `SELECT COUNT(*) FROM users;` to verify

**Connection refused:**
- Make sure PostgreSQL is running: `brew services list` (Mac)
- Check port 5432 is not blocked by firewall

**Permission denied:**
- Make sure your user has proper permissions
- Try connecting as `postgres` superuser

## Resetting the Database

To start fresh:
```bash
# Drop and recreate database
psql -U postgres
DROP DATABASE hawk_central_db;
CREATE DATABASE hawk_central_db;
\q

# Run setup again
psql -U postgres -d hawk_central_db -f database/schema/create_tables.sql
psql -U postgres -d hawk_central_db -f database/seeds/insert_sample_data.sql
```

## Need Help?

**Contact:** Trey (Database Lead)

**Useful PostgreSQL Commands:**
- `\l` - List all databases
- `\c database_name` - Connect to database
- `\dt` - List all tables
- `\d table_name` - Describe table structure
- `\q` - Quit psql

## Next Steps

Once the database is set up:
1. Backend team can start building API endpoints
2. Frontend team can design forms based on table structure
3. Test queries are in `queries/common_queries.sql`