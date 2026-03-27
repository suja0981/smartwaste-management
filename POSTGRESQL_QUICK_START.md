# 🚀 SQLite to PostgreSQL Migration - Quick Start

## What Was Done ✅

Your Smart Waste Management backend is now **PostgreSQL-ready**! Here's what's been prepared:

### Code Changes

- ✅ Updated `requirements.txt` - Added PostgreSQL drivers
- ✅ Enhanced `database.py` - PostgreSQL connection pooling
- ✅ Updated `config.py` - PostgreSQL documentation
- ✅ Created `migrate_db.py` - Automated migration script

### Documentation

- ✅ **POSTGRESQL_SETUP.md** - Complete setup guide (9 sections)
- ✅ **POSTGRESQL_MIGRATION_CHECKLIST.md** - Step-by-step checklist
- ✅ **docker-compose.postgresql.yml** - One-click PostgreSQL with Docker
- ✅ **.env.example** - PostgreSQL config examples

---

## 🏃 TL;DR - Fastest Path (30 minutes)

### Option 1: Using Docker (Recommended for Dev)

```powershell
# 1. Have Docker installed? If not: https://www.docker.com/

# 2. Start PostgreSQL + pgAdmin
cd d:\smart-waste-management
docker-compose -f docker-compose.postgresql.yml up -d

# 3. Update config
Copy-Item backend\.env.example backend\.env
# Edit .env: DATABASE_URL=postgresql://waste_user:waste_password_dev@localhost:5432/smart_waste

# 4. Run migration
cd backend
pip install -r requirements.txt
python migrate_db.py

# 5. Test
uvicorn main:app --reload
# Visit http://localhost:8000/health
```

### Option 2: Native PostgreSQL Installation

```powershell
# 1. Install PostgreSQL
# Windows: https://www.postgresql.org/download/windows/

# 2. Create database (in PostgreSQL client)
psql -U postgres
CREATE USER waste_user WITH PASSWORD 'waste_password_dev';
CREATE DATABASE smart_waste OWNER waste_user;
GRANT ALL PRIVILEGES ON DATABASE smart_waste TO waste_user;

# 3. Same as Option 1, steps 3-5 above
```

---

## 📋 Files Modified

```
backend/
├── requirements.txt               ← Added psycopg2-binary, psycopg
├── database.py                    ← PostgreSQL connection pooling
├── config.py                      ← PostgreSQL docs
├── migrate_db.py                  ← NEW: Migration script
└── .env.example                   ← PostgreSQL examples

root/
├── POSTGRESQL_SETUP.md            ← NEW: Detailed 10-section guide
├── POSTGRESQL_MIGRATION_CHECKLIST.md ← NEW: Step-by-step
└── docker-compose.postgresql.yml  ← NEW: Docker setup
```

---

## 🔄 The Migration Process

### What migrate_db.py Does:

1. **Exports** all SQLite data to `sqlite_export.json`
2. **Creates** PostgreSQL schema (all tables)
3. **Imports** data from JSON to PostgreSQL
4. **Verifies** every table has correct row count
5. **Reports** success/failure

```powershell
python migrate_db.py
# Output:
# 📤 Exporting data from SQLite...
# ✓ users: 5 rows exported
# ✓ bins: 10 rows exported
# ✓ telemetry: 423 rows exported
# ✓ crews: 2 rows exported
# ✓ tasks: 8 rows exported
# ✓ routes: 4 rows exported
# ✓ route_history: 0 rows exported
# ✓ token_blacklist: 0 rows exported
# ...
# ✅ Migration Successful!
```

---

## ✨ Why This Upgrade?

| Metric               | SQLite      | PostgreSQL  |
| -------------------- | ----------- | ----------- |
| **Concurrent Users** | ~5          | 100+        |
| **Production Ready** | ❌          | ✅          |
| **Scalability**      | Limited     | Enterprise  |
| **Performance**      | Slow (>5ms) | Fast (<1ms) |
| **Connections**      | 1           | 1000+       |
| **Backup Tools**     | Manual      | Automatic   |

---

## 📊 Quick Verification Queries

After migration, run these to verify:

```bash
# Connect to database
psql -U waste_user -d smart_waste -h localhost

# Check table row counts
SELECT tablename FROM pg_tables WHERE schemaname='public';
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM bins;
SELECT COUNT(*) FROM telemetry;

# Check indexes
\d+ users
\d+ bins

# Connection info
SELECT version();
SELECT datname, pg_size_pretty(pg_database_size(datname)) FROM pg_database WHERE datname='smart_waste';

# Exit
\q
```

---

## 🐛 Common Issues & Fixes

### "Connection refused"

```powershell
# PostgreSQL not running?
# Docker: docker-compose -f docker-compose.postgresql.yml up -d
# Native: Check Windows Services > postgresql
```

### "Authentication failed"

```powershell
# Wrong password in .env?
# Update DATABASE_URL credentials
# Remove postgres: psql -U postgres -c "ALTER USER waste_user WITH PASSWORD 'newpass';"
```

### "Module 'psycopg' not found"

```powershell
# Dependencies not installed?
pip install -r backend/requirements.txt
```

### "Cannot drop database, in use"

```powershell
# Another connection open?
# docker-compose down
# Or psql disconnect all users
```

---

## 🔒 Security Checklist

- [ ] Change `waste_password_dev` to strong password (↑32 chars)
- [ ] Store password in `.env` (NOT in code)
- [ ] Add `.env` to `.gitignore`
- [ ] Use SSL for PostgreSQL in production
- [ ] Restrict database access by IP
- [ ] Regular automated backups

---

## 📚 Full Documentation

Read these in order:

1. **POSTGRESQL_MIGRATION_CHECKLIST.md** - Your step-by-step guide
2. **POSTGRESQL_SETUP.md** - Deep dive into each section
3. **Backend code** - See database.py for connection pool settings

---

## ✅ Next Steps

### Immediate (Right Now)

- [ ] Read POSTGRESQL_MIGRATION_CHECKLIST.md
- [ ] Choose Docker or Native PostgreSQL
- [ ] Follow the checklist

### After Migration

- [ ] Test all API endpoints
- [ ] Verify frontend still works
- [ ] Monitor backend logs
- [ ] Archive old SQLite DB

### Production (Later)

- [ ] Deploy to cloud database (AWS RDS, Azure, etc.)
- [ ] Set up automated backups
- [ ] Configure monitoring
- [ ] Performance tune

---

## 🎯 Success Criteria

After migration, verify:

- ✅ Backend starts without errors
- ✅ Health endpoint returns OK
- ✅ All bins visible via API
- ✅ Frontend loads dashboard
- ✅ No "Connection refused" errors
- ✅ sqlite_export.json backup exists

---

## 🆘 Need Help?

1. Check **POSTGRESQL_SETUP.md** section 10 (Troubleshooting)
2. Review **POSTGRESQL_MIGRATION_CHECKLIST.md** for your step
3. Check backend logs: `tail -f backend.log`
4. Check PostgreSQL logs: `psql -U waste_user -d smart_waste -c "SELECT * FROM pg_stat_activity"`

---

**Ready to migrate? Open POSTGRESQL_MIGRATION_CHECKLIST.md and follow along!** ✨
