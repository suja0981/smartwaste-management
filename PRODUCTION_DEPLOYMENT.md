# Production Deployment Guide

Smart Waste Management System - Production Readiness Documentation

## Overview

This guide covers hardening and deploying the Smart Waste Management System to production.

## 1. Pre-Deployment Checklist

### Security
- [ ] Update `SECRET_KEY` in `.env` with a secure random string
  ```bash
  # Generate secure secret key
  python -c "import secrets; print(secrets.token_hex(32))"
  ```
- [ ] Set `ENVIRONMENT=production` in `.env`
- [ ] Update `CORS_ORIGINS` to your production domain
- [ ] Enable HTTPS/SSL certificates
- [ ] Review and update `ALGORITHM` if different from HS256
- [ ] Enable password policy enforcement
- [ ] Enable rate limiting in production
- [ ] Enable audit logging

### Database
- [ ] Switch from SQLite to production database (PostgreSQL/MySQL recommended)
  ```
  # Example PostgreSQL
  DATABASE_URL=postgresql://user:password@prod-server:5432/smart_waste
  ```
- [ ] Run database migrations
- [ ] Set up automated backups
- [ ] Test database recovery process

### API Configuration
- [ ] Set `API_RELOAD=false`
- [ ] Set `LOG_LEVEL=WARNING` or higher
- [ ] Disable Swagger UI/ReDoc in production (already configured)
- [ ] Enable request logging
- [ ] Configure error tracking (Sentry, etc.)

### Frontend
- [ ] Set `NEXT_PUBLIC_API_URL` to production API endpoint
- [ ] Build optimized production bundle
- [ ] Enable security headers
- [ ] Configure Content Security Policy
- [ ] Enable GZIP compression

## 2. Database Migration from SQLite

### Step 1: Export Data from Development
```bash
# SQLite to CSV export for critical tables
sqlite3 smart_waste.db ".mode csv" ".output bins.csv" "SELECT * FROM bins;"
sqlite3 smart_waste.db ".mode csv" ".output users.csv" "SELECT * FROM users;"
```

### Step 2: Set Up PostgreSQL
```bash
# Install PostgreSQL adapter
pip install psycopg2-binary

# Create database
createdb smart_waste
```

### Step 3: Update Configuration
```env
DATABASE_URL=postgresql://user:password@localhost:5432/smart_waste
ENVIRONMENT=production
```

### Step 4: Reinitialize Database
```bash
python -c "from database import Base, engine; Base.metadata.create_all(bind=engine)"
```

## 3. Securing Secrets Management

### Using Environment Variables
```bash
# Never commit .env file
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
```

### Using Docker Secrets (Recommended)
```dockerfile
# Dockerfile example
FROM python:3.13

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# Run with non-root user
RUN useradd -m appuser
USER appuser

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Using Cloud Provider Secrets
- AWS Secrets Manager
- Azure Key Vault
- Google Cloud Secret Manager

## 4. SSL/TLS Configuration

### Using Nginx with Let's Encrypt
```nginx
server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

## 5. Application Hardening

### Security Headers (Implemented in `security.py`)
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000
Content-Security-Policy: default-src 'self'
Referrer-Policy: strict-origin-when-cross-origin
```

### Password Policy
Enforce strong passwords:
- Minimum 8 characters
- Mix of uppercase and lowercase
- At least one digit
- At least one special character

### Rate Limiting
Configured to 100 requests per minute per IP

### Input Validation
- Maximum payload size: 10MB
- SQL injection prevention via ORM
- XSS prevention through proper encoding

## 6. Monitoring & Logging

### Application Logging
```python
# Set up structured logging
import logging
logging.basicConfig(level=logging.INFO)
```

### Performance Monitoring
- Set up APM (Application Performance Monitoring)
- Monitor database query times
- Track API response times
- Monitor server resource usage

### Error Tracking
```bash
# Install Sentry for error tracking
pip install sentry-sdk
```

### Log Aggregation
- Consider ELK Stack (Elasticsearch, Logstash, Kibana)
- Or CloudWatch, DataDog, New Relic

## 7. Backup & Disaster Recovery

### Database Backups
```bash
# Daily PostgreSQL backup
0 2 * * * pg_dump smart_waste > /backups/smart_waste_$(date +\%Y\%m\%d).sql

# Test restoration regularly
pg_restore --dbname=smart_waste_test < /backups/smart_waste_20240302.sql
```

### Storage Strategy
- Store backups off-site
- Test recovery process monthly
- Document recovery procedures

## 8. Deployment Options

### Docker Compose
```yaml
version: '3.8'
services:
  api:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - ENVIRONMENT=production
      - DATABASE_URL=postgresql://user:pass@db:5432/smart_waste
    depends_on:
      - db
  
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
  
  db:
    image: postgres:15
    environment:
      POSTGRES_PASSWORD: secure_password
    volumes:
      - db_data:/var/lib/postgresql/data

volumes:
  db_data:
```

### Kubernetes
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: smart-waste-api
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: api
        image: smart-waste:latest
        env:
        - name: ENVIRONMENT
          value: "production"
        - name: SECRET_KEY
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: secret-key
```

## 9. Performance Optimization

### Frontend
```bash
# Build optimized production bundle
cd frontend
pnpm build
```

### Backend
```python
# Enable gzip compression
from fastapi.middleware.gzip import GZIPMiddleware
app.add_middleware(GZIPMiddleware, minimum_size=1000)
```

### Caching
- Implement Redis for session caching
- Cache API responses where appropriate
- Set appropriate cache headers

## 10. Compliance & Security

- [ ] GDPR Compliance (if serving EU users)
- [ ] Data encryption at rest and in transit
- [ ] Regular security audits
- [ ] Penetration testing
- [ ] Regular dependency updates
- [ ] Security headers validation
- [ ] API rate limiting and throttling

## 11. Monitoring Checklist

- [ ] CPU usage within limits
- [ ] Memory usage monitored
- [ ] Disk space warnings
- [ ] Database connection pool health
- [ ] API response times
- [ ] Error rates
- [ ] Failed login attempts
- [ ] Database replication lag (if applicable)

## 12. Emergency Procedures

### Database Recovery
1. Stop application
2. Restore from backup
3. Verify data integrity
4. Restart application

### Certificate Renewal
```bash
certbot renew --nginx
# Set up automatic renewal
0 3 * * * certbot renew --quiet
```

### Incident Response
- Document all incidents
- Have rollback procedures
- Maintain change logs
- Test disaster recovery monthly

## Quick Start Commands

```bash
# Production deployment
ENVIRONMENT=production \
SECRET_KEY=$(python -c "import secrets; print(secrets.token_hex(32))") \
DATABASE_URL=postgresql://user:password@host:5432/db \
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --workers 4

# For frontend
cd frontend
NEXT_PUBLIC_API_URL=https://api.yourdomain.com \
pnpm build && pnpm start
```

## Support & Troubleshooting

For issues, check:
1. Application logs
2. Database logs
3. Server resource usage
4. Network connectivity
5. SSL certificate validity
6. CORS configuration

---

**Last Updated:** March 2, 2026
**Version:** 3.0.0
