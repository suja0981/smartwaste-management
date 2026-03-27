# PostgreSQL Setup & Migration Guide

## 1️⃣ Install PostgreSQL

### Windows

```powershell
# Using Chocolatey
choco install postgresql

# Or download from https://www.postgresql.org/download/windows/
```

### macOS

```bash
brew install postgresql@15
brew services start postgresql@15
```

### Linux (Ubuntu/Debian)

```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
```

---

## 2️⃣ Create Database User & Database

### Connect to PostgreSQL

```bash
# Windows/macOS/Linux
psql -U postgres
```

### Create user and database

```sql
-- Create user (change password!)
CREATE USER waste_user WITH PASSWORD 'your_secure_password_here';

-- Create database
CREATE DATABASE smart_waste OWNER waste_user;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE smart_waste TO waste_user;
\q
```

---

## 3️⃣ Verify PostgreSQL Connection

```bash
# Test connection
psql -U waste_user -d smart_waste -h localhost -c "SELECT version();"
```

Expected output:

```
PostgreSQL 15.x on ...
```

---

## 4️⃣ Install Python Dependencies

```powershell
cd backend
pip install -r requirements.txt
```

Key new packages:

- `psycopg2-binary==2.9.9` - PostgreSQL driver (compiled)
- `psycopg==3.1.12` - PostgreSQL 3 native driver (optional, faster)

---

## 5️⃣ Configure Environment

### Create/Update `.env` file in backend/:

```env
DATABASE_URL=postgresql://waste_user:your_secure_password_here@localhost:5432/smart_waste

# Or use psycopg (newer, faster)
DATABASE_URL=postgresql+psycopg://waste_user:your_secure_password_here@localhost:5432/smart_waste
```

### Or set environment variable:

```powershell
# PowerShell
$env:DATABASE_URL = "postgresql://waste_user:password@localhost:5432/smart_waste"

# Command Prompt
set DATABASE_URL=postgresql://waste_user:password@localhost:5432/smart_waste
```

---

## 6️⃣ Run Migration Script

### Prerequisites:

- ✅ PostgreSQL server running
- ✅ Database created (smart_waste)
- ✅ Dependencies installed
- ✅ DATABASE_URL configured in .env

### Execute migration:

```powershell
cd backend
python migrate_db.py
```

**Script will:**

1. ✅ Export all data from SQLite to JSON
2. ✅ Create PostgreSQL schema
3. ✅ Import data to PostgreSQL
4. ✅ Verify data integrity
5. ✅ Save backup: `sqlite_export.json`

---

## 7️⃣ Verify Migration

### Check PostgreSQL tables:

```bash
psql -U waste_user -d smart_waste -h localhost

# List tables
\dt

# Count rows in each table
SELECT tablename FROM pg_tables WHERE schemaname='public';
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM bins;
SELECT COUNT(*) FROM telemetry;
SELECT COUNT(*) FROM crews;
SELECT COUNT(*) FROM tasks;
SELECT COUNT(*) FROM routes;
SELECT COUNT(*) FROM token_blacklist;
```

### Check table schemas:

```bash
\d+ users
\d+ bins
\d+ telemetry
```

---

## 8️⃣ Test Backend with PostgreSQL

```powershell
cd backend
uvicorn main:app --reload
```

Expected output:

```
INFO:     Started server process
DATABASE_URL: postgresql://...
✓ Connected to PostgreSQL
```

### Test endpoints:

```bash
# Health check
curl http://localhost:8000/health

# Get bins (should show migrated data)
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8000/bins

# Swagger UI
http://localhost:8000/docs
```

---

## 9️⃣ Archive Old SQLite Database

```powershell
# Backup SQLite
Rename-Item -Path .\smart_waste.db -NewName .\smart_waste.db.backup

# Or in PowerShell
Move-Item -Path .\smart_waste.db -Destination .\smart_waste.db.backup
```

---

## 🔟 Production Deployment

### Update `.env` with production PostgreSQL:

```env
DATABASE_URL=postgresql://user:password@prod-db-host:5432/smart_waste
```

### Connection pool settings (from database.py):

```python
# Updated for 1000+ concurrent users:
pool_size=20,
max_overflow=40,
pool_pre_ping=True,
pool_recycle=3600,  # Recycle connections every hour
```

### RDS/Cloud Setup:

```
AWS RDS:        psql -h smart-waste-db.xxxxx.us-east-1.rds.amazonaws.com -U admin
Azure Database: psql -h smart-waste.postgres.database.azure.com -U admin@smart-waste
Digital Ocean:  psql -h db-xxx-do-user-xxx.b.db.ondigitalocean.com ...
```

---

## 🐞 Troubleshooting

### Connection refused

```
Error: could not connect to server
Fix: Check PostgreSQL is running
  Windows: Check Services > postgresql
  macOS: brew services list
  Linux: sudo systemctl status postgresql
```

### Authentication failed

```
Error: FATAL: password authentication failed
Fix: Check DATABASE_URL credentials
  psql -U waste_user -d smart_waste -h localhost -W
  Verify user/password created correctly
```

### "already exists" error during schema creation

```
Error: relation "users" already exists
Fix: Drop existing schema first
  psql -U postgres -c "DROP DATABASE smart_waste;"
  Then recreate and re-run migration
```

### No data imported

```
Check: python migrate_db.py verbose
  Look for sqlite_export.json file
  Verify SQLite still has data
  Check connection to PostgreSQL
```

---

## 📊 Performance Comparison

| Metric           | SQLite         | PostgreSQL          |
| ---------------- | -------------- | ------------------- |
| Concurrent Users | 5-10           | 100+                |
| Query Speed      | Slow for joins | Fast with indexing  |
| Scalability      | Single file    | Distributed         |
| Backup           | File copy      | Native backup tools |
| Production Ready | ❌ No          | ✅ Yes              |

---

## 🔄 Rollback to SQLite (if needed)

```powershell
# Restore backup
Move-Item -Path .\smart_waste.db.backup -Destination .\smart_waste.db

# Update .env
DATABASE_URL=sqlite:///./smart_waste.db

# Restart backend
uvicorn main:app --reload
```

---

## 📚 Next Steps

1. ✅ Test all endpoints with PostmanMonkey schema
2. ✅ Update frontend API if needed
3. ✅ Set up automatic backups
4. ✅ Configure PostgreSQL maintenance (VACUUM, ANALYZE)
5. ✅ Monitor connection pool usage

---

**Questions?** Check PostgreSQL docs: https://www.postgresql.org/docs/
