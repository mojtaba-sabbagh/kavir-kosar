# Database and File Backup Feature

## Overview

The backup and restore feature allows administrators to:
- **Backup**: Create a complete backup of the PostgreSQL database and all uploaded files
- **Restore**: Upload and restore from a backup file to recover the entire system

The backups are created as compressed `.tar.gz` archives that can be stored safely for disaster recovery.

## Backup Feature

### Creating a Backup

1. Go to **Admin Panel** → **پشتیبان‌گیری** (Backup)
2. Click **ایجاد و دانلود پشتیبان** (Create and Download Backup)
3. Wait for the backup to complete (may take several minutes for large databases)
4. The backup file will download automatically as `backup-YYYY-MM-DD.tar.gz`

### Backup Contents

```
backup-2025-12-11.tar.gz
├── database.sql      # PostgreSQL database dump
└── uploads/          # All uploaded files
    ├── file1.pdf
    ├── file2.jpg
    └── ...
```

## Restore Feature

### Using the Web Interface (Recommended)

1. Go to **Admin Panel** → **بازیابی** (Restore)
2. Click the file input field and select your `.tar.gz` backup file
3. Review the warning message carefully
4. Click **شروع بازیابی** (Start Restore)
5. Wait for the restoration to complete
6. The system will automatically refresh

**Important**: Restoration will replace all current data. A confirmation dialog will appear.

### Manual Restoration (Command Line)

#### Extract the Archive

```bash
tar -xzf backup-2025-12-11.tar.gz
```

This creates:
- `database.sql` - PostgreSQL database dump
- `uploads/` - All uploaded files

#### Restore the Database

**Option 1: Drop and Recreate (Recommended for full restore)**

```bash
# Connect to your PostgreSQL server
psql -U postgres -h localhost

# In psql:
DROP DATABASE IF EXISTS kkrdb;
CREATE DATABASE kkrdb;
\q

# Restore the dump
psql -U postgres -d kkrdb -h localhost < database.sql
```

**Option 2: Restore to Existing Database**

```bash
psql -U postgres -d kkrdb -h localhost < database.sql
```

**Option 3: For Docker**

```bash
# If using Docker Compose
docker-compose exec postgres psql -U postgres -c "DROP DATABASE IF EXISTS kkrdb; CREATE DATABASE kkrdb;"
docker-compose exec -T postgres psql -U postgres -d kkrdb < database.sql
```

#### Restore Uploaded Files

```bash
# Replace the existing uploads directory
rm -rf /path/to/app/public/uploads/*
cp -r uploads/* /path/to/app/public/uploads/

# Fix permissions if needed
chmod 755 /path/to/app/public/uploads
chmod 644 /path/to/app/public/uploads/*
```

#### Restart the Application

```bash
# If using Docker
docker-compose restart app

# If using systemd
sudo systemctl restart kosar-kavir

# If running locally
npm run dev  # or your production start command
```

## Backup Restoration in Docker

When restoring to a Docker environment:

```bash
# 1. Upload the backup file to the server
scp backup-2025-12-11.tar.gz user@server:/tmp/

# 2. SSH into the server
ssh user@server

# 3. Extract the backup
cd /tmp
tar -xzf backup-2025-12-11.tar.gz

# 4. Restore the database
docker-compose exec -T postgres psql -U postgres -c "DROP DATABASE IF EXISTS kkrdb; CREATE DATABASE kkrdb;"
docker-compose exec -T postgres psql -U postgres -d kkrdb < database.sql

# 5. Restore files
docker-compose exec app sh -c "rm -rf /app/public/uploads/*"
docker cp uploads/. <container_id>:/app/public/uploads/

# 6. Restart the application
docker-compose restart app
```

## Features

- **PostgreSQL Database Backup**: Uses `pg_dump` to create a complete SQL dump
- **File Backups**: Includes all files uploaded by users (`public/uploads/`)
- **Compression**: Archives are compressed with gzip for efficient storage
- **Admin-Only Access**: Requires administrator permissions
- **One-Click Operations**: Easy backup creation/download and web-based restoration
- **Progress Feedback**: Detailed success/error messages

## Requirements

### Local Development (macOS with Homebrew)

```bash
# Install PostgreSQL with Homebrew
brew install postgresql

# Verify pg_dump is available
which pg_dump
```

### Docker Production (Ubuntu)

The Dockerfile includes required tools:

```dockerfile
RUN apk add --no-cache postgresql-client tar gzip
```

These provide:
- `postgresql-client`: `pg_dump` and `psql` commands
- `tar` and `gzip`: For creating/extracting archives

**After Dockerfile changes, rebuild and redeploy:**

```bash
docker build -t your-registry/kosar-kavir:latest .
docker push your-registry/kosar-kavir:latest
docker-compose pull
docker-compose up -d
```

## Environment Configuration

### Docker Compose Example

```yaml
version: '3.8'

services:
  app:
    image: kosar-kavir:latest
    environment:
      DATABASE_URL: postgresql://postgres:password@postgres:5432/kkrdb
    depends_on:
      - postgres
    networks:
      - backend
    
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: kkrdb
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - backend

volumes:
  postgres_data:

networks:
  backend:
```

## Troubleshooting

### Backup Issues

#### "pg_dump: command not found"

**Solution**: 
- On macOS: `brew install postgresql`
- In Docker: Rebuild image with updated Dockerfile
- On Linux: `apt-get install postgresql-client`

#### Backup File is Too Large

**Tips**:
- Back up during off-peak hours
- Consider archiving old uploaded files
- Use external storage for large files

### Restore Issues

#### "Cannot connect to database"

**Check**:
```bash
# Test connection
psql postgresql://user:password@host:port/database

# In Docker
docker-compose exec postgres psql -U user -d database
```

#### "Invalid backup file"

**Ensure**:
- File ends with `.tar.gz`
- File is not corrupted
- File was created with the backup feature

#### "Insufficient disk space"

**Solution**:
- Free up disk space before restoring
- Consider restoring to a larger drive
- Check available space: `df -h`

## Best Practices

1. **Regular Backups**: Weekly or monthly backups
2. **Offsite Storage**: Store backups on external servers/cloud
3. **Test Restores**: Regularly test that restores work
4. **Document**: Keep notes of backup dates and purposes
5. **Monitor Space**: Ensure sufficient disk space
6. **Verify Integrity**: Check backup files are not corrupted

## API Endpoints

### Backup Endpoint
```
POST /api/admin/backup
```

### Restore Endpoint
```
POST /api/admin/restore
```

Both require:
- Admin role
- Session-based authentication
- `Content-Type: multipart/form-data` (restore only)

## Security Considerations

1. **Admin-Only**: Only administrators can backup/restore
2. **Data in URL**: Database password in `DATABASE_URL` - secure the server
3. **Temporary Files**: Automatically cleaned up after operations
4. **No Logging**: Sensitive data not logged
5. **Encryption**: Use HTTPS in production
6. **Access Control**: Restrict who can access the admin panel

## Recovery Procedures

### Complete System Failure

1. Restore fresh operating system
2. Install Docker and docker-compose
3. Clone the application repository
4. Update `.env` with production settings
5. Run: `docker-compose up -d`
6. Use the restore API endpoint to restore database and files
7. Verify application is working

### Database Corruption

```bash
# 1. Create a backup of corrupted state (for inspection)
pg_dump -d original_db > corrupted_dump.sql

# 2. Restore from good backup
docker-compose exec -T postgres psql -U postgres -c "DROP DATABASE IF EXISTS kkrdb; CREATE DATABASE kkrdb;"
docker-compose exec -T postgres psql -U postgres -d kkrdb < backup-YYYY-MM-DD/database.sql

# 3. Restart application
docker-compose restart app

# 4. Verify integrity
docker-compose logs app | grep -i error
```

### Partial File Loss

```bash
# 1. Find what files are missing
ls -la /path/to/app/public/uploads

# 2. Restore only missing files
tar -xzf backup-YYYY-MM-DD.tar.gz uploads/
cp -r uploads/* /path/to/app/public/uploads/
```

## Version History

- **v1.0** (Dec 2025): Initial backup and restore feature
  - Backup: Database + uploads
  - Restore: Web-based upload and restore
  - Docker support with Alpine Linux

