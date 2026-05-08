# Deploy DLP User to Production Server

## Overview
This guide provides step-by-step instructions to deploy the DLP user (`DLP/PRINCIPAL/0001/2024`) to the production server at iheza.online.

## Prerequisites
1. SSH access to the production server
2. MongoDB credentials for the production database
3. Python 3.7+ installed on the production server
4. Required Python packages: `motor`, `python-dotenv`, `bcrypt`

## Option 1: Safe Import (Recommended)
Use the safe import script that only adds/updates the DLP user without affecting other users.

### Step 1: Copy Files to Production Server
```bash
# On your local machine
scp /path/to/local/backend/import_dlp_user_safe.py user@iheza.online:/tmp/
scp /path/to/local/backend/database.py user@iheza.online:/tmp/
scp /path/to/local/backend/.env.production user@iheza.online:/tmp/  # If you have production .env
```

### Step 2: SSH into Production Server
```bash
ssh user@iheza.online
```

### Step 3: Navigate to Backend Directory
```bash
cd /path/to/production/backend
```

### Step 4: Backup Current Database (Optional but Recommended)
```bash
# Backup users collection
mongodump --db your_database_name --collection users --out /tmp/mongodb_backup_$(date +%Y%m%d_%H%M%S)
```

### Step 5: Set Up Environment
```bash
# Copy the safe import script
cp /tmp/import_dlp_user_safe.py .

# Create or update .env file with production MongoDB credentials
cat > .env << EOF
MONGO_URL=mongodb://production_username:production_password@production_host:27017
DB_NAME=production_database_name
EOF

# Install required Python packages if not already installed
pip install motor python-dotenv bcrypt
```

### Step 6: Run the Safe Import Script
```bash
python import_dlp_user_safe.py
```

### Step 7: Verify the Import
The script will automatically verify the import. You should see output like:
```
✓ DLP user verified in database:
  access_code: DLP/PRINCIPAL/0001/2024
  first_name: DLP
  last_name: Principal
  ...
```

## Option 2: Full Staff Import (Use with Caution)
Use the full `import_staff.py` script which replaces ALL users.

**WARNING**: This will delete all existing users and re-import only the users in the STAFF_MEMBERS list.

### Step 1: Update import_staff.py on Production
Make sure the production `import_staff.py` includes the DLP user (it should match the local version).

### Step 2: Backup Database
```bash
mongodump --db your_database_name --collection users --out /tmp/full_backup_$(date +%Y%m%d_%H%M%S)
```

### Step 3: Run Full Import
```bash
cd /path/to/production/backend
python import_staff.py
```

## Option 3: Direct MongoDB Insertion
If you have `mongosh` or `mongo` shell access:

### Step 1: Connect to MongoDB
```bash
mongosh "mongodb://production_host:27017/production_database_name" --username production_username --password production_password
```

### Step 2: Insert DLP User
```javascript
// Generate a UUID for the user
var userId = "dlp-" + new ObjectId().toString();

// Insert the DLP user
db.users.insertOne({
  "id": userId,
  "access_code": "DLP/PRINCIPAL/0001/2024",
  "first_name": "DLP",
  "last_name": "Principal",
  "name": "DLP Principal",
  "email": "principal@dlp.edu",
  "phone": "",
  "role": "principal",
  "chain": "DLP",
  "status": "active",
  "password_hash": "$2b$12$...", // bcrypt hash of "DLP00000"
  "created_at": new Date().toISOString(),
  "updated_at": new Date().toISOString()
});

// Verify the insertion
db.users.find({access_code: "DLP/PRINCIPAL/0001/2024"});
```

To generate the bcrypt hash:
```bash
python -c "import bcrypt; print(bcrypt.hashpw('DLP00000'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8'))"
```

## Option 4: API Call (If Backend is Running)
If the backend server is running and you have an admin token:

### Step 1: Get Admin Token
```bash
# Login as director or coordinator to get token
curl -X POST 'https://iheza.online/api/auth' \
  -H 'Content-Type: application/json' \
  -d '{
    "accessCode": "IHEZA/DIRECTOR/0001/2020",
    "password": "IHEZA00000",
    "portal": "director"
  }'
```

### Step 2: Create DLP User via API
```bash
# Use the token from Step 1
curl -X POST 'https://iheza.online/api/users' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_ADMIN_TOKEN' \
  -d '{
    "access_code": "DLP/PRINCIPAL/0001/2024",
    "first_name": "DLP",
    "last_name": "Principal",
    "email": "principal@dlp.edu",
    "phone": "",
    "role": "principal",
    "status": "active",
    "password": "DLP00000"
  }'
```

## Verification Steps

After deploying, verify the DLP user can log in:

### 1. Test Login via Web Interface
- Go to https://iheza.online
- Select "Principal" portal
- Enter:
  - Access Code: `DLP/PRINCIPAL/0001/2024`
  - Password: `DLP00000`

### 2. Test Login via API
```bash
curl -X POST 'https://iheza.online/api/auth' \
  -H 'Content-Type: application/json' \
  -d '{
    "accessCode": "DLP/PRINCIPAL/0001/2024",
    "password": "DLP00000",
    "portal": "principal"
  }'
```

### 3. Check Database Directly
```bash
mongosh "mongodb://production_host:27017/production_database_name" \
  --username production_username \
  --password production_password \
  --eval "db.users.find({access_code: 'DLP/PRINCIPAL/0001/2024'})"
```

## Troubleshooting

### If MongoDB Connection Fails:
- Check `.env` file has correct credentials
- Verify MongoDB server is running: `systemctl status mongod`
- Check firewall rules allow connections

### If Python Script Fails:
- Check Python version: `python --version`
- Install missing packages: `pip install motor python-dotenv bcrypt`
- Check file permissions: `chmod +x import_dlp_user_safe.py`

### If Login Still Fails:
1. Check user status is "active" in database
2. Verify password hash is correct
3. Check backend server logs for authentication errors
4. Verify the access code matches exactly: `DLP/PRINCIPAL/0001/2024`

## Files to Deploy

From your local `backend/` directory, deploy these files to production:
1. `import_dlp_user_safe.py` - Safe import script
2. `database.py` - Database connection module
3. Updated `.env` file with production credentials

## Rollback Plan

If something goes wrong:

1. **Restore from backup**:
   ```bash
   mongorestore --db production_database_name --collection users /tmp/mongodb_backup_*/production_database_name/users.bson
   ```

2. **Remove DLP user manually**:
   ```bash
   mongosh --eval "db.users.deleteOne({access_code: 'DLP/PRINCIPAL/0001/2024'})"
   ```

## Support

If you encounter issues:
1. Check server logs: `journalctl -u your_backend_service`
2. Check MongoDB logs: `tail -f /var/log/mongodb/mongod.log`
3. Verify network connectivity between backend and MongoDB