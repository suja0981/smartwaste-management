# 🗂️ PostgreSQL Migration Checklist

## Phase 1: Preparation ✓

- [ ] **Read POSTGRESQL_SETUP.md** - Understand the full process
- [ ] **Backup SQLite database** - Copy `smart_waste.db` to safe location
  ```powershell
  Copy-Item .\smart_waste.db -Destination .\smart_waste.db.backup
  ```

---

## Phase 2: PostgreSQL Installation

### Option A: Native Install

- [ ] **Install PostgreSQL**
  - Windows: https://www.postgresql.org/download/windows/
  - macOS: `brew install postgresql@15`
  - Linux: `sudo apt-get install postgresql`
- [ ] **Start PostgreSQL service**
  - Windows: Check Services > postgresql-x64
  - macOS: `brew services start postgresql@15`
  - Linux: `sudo systemctl start postgresql`
- [ ] **Create database user and database**
  ```sql
  psql -U postgres
  CREATE USER waste_user WITH PASSWORD 'your_password';
  CREATE DATABASE smart_waste OWNER waste_user;
  GRANT ALL PRIVILEGES ON DATABASE smart_waste TO waste_user;
  ```
- [ ] **Test connection**
  ```bash
  psql -U waste_user -d smart_waste -h localhost -c "SELECT version();"
  ```

### Option B: Docker Install (Easy Alternative)

- [ ] **Have Docker installed** - https://www.docker.com/
- [ ] **Start PostgreSQL with Docker Compose**
  ```powershell
  docker-compose -f docker-compose.postgresql.yml up -d
  docker ps  # Verify postgres and pgadmin running
  ```
- [ ] **Access pgAdmin** at http://localhost:5050
  - Login: admin@smart-waste.local / admin
  - Add server: Server > Register > Server
  - Name: smart-waste
  - Host: postgres
  - Username: waste_user
  - Password: waste_password_dev
- [ ] **Test connection in pgAdmin**

---

## Phase 3: Dependencies & Configuration

- [ ] **Update requirements.txt**
  ```powershell
  # Should include:
  # psycopg2-binary==2.9.9
  # psycopg==3.1.12
  ```
- [ ] **Install dependencies**
  ```powershell
  cd backend
  pip install -r requirements.txt
  ```
- [ ] **Create .env file** (copy from .env.example)
  ```powershell
  Copy-Item .\.env.example -Destination .\.env
  ```
- [ ] **Update DATABASE_URL in .env**
  ```env
  DATABASE_URL=postgresql://waste_user:waste_password_dev@localhost:5432/smart_waste
  ```
- [ ] **Verify .env is in .gitignore**
  ```powershell
  # Make sure .env is NOT committed to git!
  cat .gitignore | Select-String ".env"
  ```

---

## Phase 4: Data Migration

- [ ] **Run migration script**

  ```powershell
  cd backend
  python migrate_db.py
  ```

  Expected output:

  ```
  ✅ Exporting data from SQLite...
  ✅ Creating PostgreSQL schema...
  ✅ Importing data to PostgreSQL...
  ✅ Verifying migration...
  ✅ Migration Successful!
  ```

- [ ] **Verify data was imported**

  ```bash
  psql -U waste_user -d smart_waste -h localhost
  SELECT COUNT(*) FROM users;
  SELECT COUNT(*) FROM bins;
  SELECT COUNT(*) FROM telemetry;
  SELECT COUNT(*) FROM crews;
  SELECT COUNT(*) FROM tasks;
  SELECT COUNT(*) FROM routes;
  SELECT COUNT(*) FROM token_blacklist;
  \q
  ```

- [ ] **Check sqlite_export.json backup file**
  ```powershell
  ls -la sqlite_export.json  # Should exist as backup
  ```

---

## Phase 5: Backend Testing

- [ ] **Start backend with PostgreSQL**

  ```powershell
  cd backend
  uvicorn main:app --reload
  ```

  Expected output:

  ```
  INFO:     Started server process
  INFO:     DATABASE_URL: postgresql://...
  INFO:     ✓ Connected to PostgreSQL
  ```

- [ ] **Test health endpoint**

  ```bash
  curl http://localhost:8000/health
  # Expected: {"status":"ok",...}
  ```

- [ ] **Test bins endpoint**

  ```bash
  curl http://localhost:8000/bins
  # Expected: [{"id":"BIN001",...}, ...]
  ```

- [ ] **Test Swagger UI**
  - Open http://localhost:8000/docs
  - Try endpoints: GET /bins, GET /stats, etc.

- [ ] **Test with Postman/Insomnia**
  - Import requests
  - Run full API test suite
  - Verify response times improved

---

## Phase 6: Frontend Testing

- [ ] **Frontend still running on http://localhost:3000**
- [ ] **Dashboard loads correctly**
- [ ] **All CRUD operations work**
  - View bins
  - Create bin (if endpoint exists)
  - Update bin
  - Delete bin
- [ ] **Charts/graphs render properly**
- [ ] **No console errors**
- [ ] **Network calls show PostgreSQL is being used**

---

## Phase 7: Performance Verification

- [ ] **Query performance**

  ```bash
  # Time a complex query
  time psql -U waste_user -d smart_waste -c "SELECT COUNT(*) FROM telemetry"
  ```

- [ ] **Connection pool status**

  ```bash
  # Check active connections
  psql -U waste_user -d smart_waste -c "SELECT pg_stat_activity"
  ```

- [ ] **Database size**
  ```bash
  psql -U waste_user -d smart_waste -c "SELECT pg_database.datname, pg_size_pretty(pg_database_size(pg_database.datname)) FROM pg_database"
  ```

---

## Phase 8: Cleanup

- [ ] **Archive old SQLite database**

  ```powershell
  Rename-Item -Path .\smart_waste.db -NewName .\smart_waste.db.backup
  # Or delete if confident
  ```

- [ ] **Remove development database backup**

  ```powershell
  # After days of successful testing
  Remove-Item .\smart_waste.db.backup
  ```

- [ ] **Commit changes to git**
  ```powershell
  git add backend/requirements.txt backend/database.py backend/config.py
  git commit -m "Migrate: SQLite to PostgreSQL"
  git push
  ```

---

## Phase 9: Documentation

- [ ] **Update README.md**
  - Add PostgreSQL setup instructions
  - Update database URL examples
  - Add Docker Compose section

- [ ] **Add to DEPLOYMENT.md**
  - PostgreSQL connection string format
  - AWS RDS / Azure Database examples

- [ ] **Create database backup schedule**
  - Daily backups recommended
  - Test restore process

---

## Phase 10: Production Deployment (if applicable)

- [ ] **Deploy to cloud database**
  - AWS RDS
  - Azure Database for PostgreSQL
  - DigitalOcean Managed Database
  - Google Cloud SQL

- [ ] **Update environment variables** with production URL

  ```env
  DATABASE_URL=postgresql://prod_user:prod_password@prod-db-host:5432/smart_waste
  ```

- [ ] **Run smoke tests** on production

  ```bash
  curl https://api.yourdomain.com/health
  curl https://api.yourdomain.com/bins
  ```

- [ ] **Monitor performance** in first 24 hours
  - Connection pool usage
  - Query performance
  - Error logs

---

## ✅ Rollback Plan (if something goes wrong)

1. Stop backend
2. Restore SQLite backup
   ```powershell
   Move-Item -Path .\smart_waste.db.backup -Destination .\smart_waste.db
   ```
3. Update DATABASE_URL back to SQLite
   ```env
   DATABASE_URL=sqlite:///./smart_waste.db
   ```
4. Restart backend
5. Investigate PostgreSQL issues
6. Retry migration

---

## 📞 Troubleshooting

If stuck, check:

- [ ] POSTGRESQL_SETUP.md - Detailed setup guide
- [ ] Backend logs - `uvicorn main:app --reload`
- [ ] PostgreSQL logs - `sudo tail -f /var/log/postgresql/...`
- [ ] .env file - Correct DATABASE_URL?
- [ ] Firewall - Port 5432 open?
- [ ] Permissions - User has database privileges?

---

**Total Time Estimate:** 30-45 minutes (including testing)

Good luck! 🚀
