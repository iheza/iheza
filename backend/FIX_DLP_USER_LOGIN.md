# Fix DLP User Login Issue

## Problem
The DLP user cannot log in on the live site (iheza.online). The errors show 401 (Unauthorized) and 503 (Service Unavailable) status codes. This suggests:

1. The backend server on the live site is down or having issues (503)
2. The user credentials are not valid on the live site (401)
3. The user was created in the local database but not on the production database

**Root Cause**: The DLP user (`DLP/PRINCIPAL/0001/2024`) exists in the local development database but not in the production database on iheza.online.

## DLP User Credentials
- **Access Code**: `DLP/PRINCIPAL/0001/2024`
- **Password**: `DLP00000`
- **Email**: `principal@dlp.edu`
- **Role**: `principal`
- **Chain**: `DLP`
- **Status**: `active`

## Solution Options

### Option 1: Update import_staff.py and Run on Production (Recommended)
The `import_staff.py` script has been updated to include the DLP user. Run this script on the production server:

```bash
cd /path/to/backend
python import_staff.py
```

**Note**: This script will clear all existing users and re-import them. Make sure to backup first if needed.

**Before running**: Update the `import_staff.py` script on the production server to include the DLP user entry that has been added to the local version.

### Option 2: Use the API to Create the User
Use the provided curl command or API payload to create the DLP user via the API:

```bash
# First, get an admin token by logging in as director or coordinator
# Then run:
bash create_dlp_user_curl.sh
```

Or manually:
```bash
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

**Note**: You need an admin token (director or coordinator role) to use the `/api/users` endpoint.

### Option 3: Direct Database Insertion (For Database Admins)
If you have direct access to the production MongoDB database, you can insert the user directly:

1. Connect to the production MongoDB database
2. Insert the following document into the `users` collection:

```javascript
{
  "id": "generate-a-uuid-here",
  "access_code": "DLP/PRINCIPAL/0001/2024",
  "first_name": "DLP",
  "last_name": "Principal",
  "name": "DLP Principal",
  "email": "principal@dlp.edu",
  "phone": "",
  "role": "principal",
  "chain": "DLP",
  "status": "active",
  "password_hash": "bcrypt-hash-of-DLP00000",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

**Password Hash**: Use `bcrypt.hashpw("DLP00000".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')` to generate the hash.

### Option 4: Use the add_dlp_user_to_production.py Script
A dedicated script `add_dlp_user_to_production.py` has been created to add the DLP user to any MongoDB database:

```bash
cd /app/backend
# Set environment variables
export PRODUCTION_MONGO_URL="mongodb://your-production-mongo-url"
export PRODUCTION_DB_NAME="your-production-db-name"
python add_dlp_user_to_production.py
```

Or run interactively:
```bash
cd /app/backend
python add_dlp_user_to_production.py
```

The script will prompt for MongoDB connection details if not provided as environment variables.

## Verification Steps

After applying any of the solutions:

1. **Test Login**: Try logging in with the DLP user credentials on iheza.online
2. **Check Database**: Verify the user exists in the production database:
   ```javascript
   db.users.find({access_code: "DLP/PRINCIPAL/0001/2024"})
   ```
3. **Check API**: Verify via API (if you have admin token):
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" https://iheza.online/api/users
   ```

## Files Created/Modified

1. **`import_staff.py`** - Updated to include DLP user in STAFF_MEMBERS list
2. **`export_dlp_user.py`** - Script to export DLP user data for migration
3. **`add_dlp_user_to_production.py`** - Script to add DLP user to any MongoDB
4. **`create_dlp_user_curl.sh`** - Curl command to create user via API
5. **`dlp_user_export.json`** - Exported DLP user data
6. **`dlp_user_api_payload.json`** - API payload for creating DLP user

## Troubleshooting

### If you still get 503 error:
- Check if the backend server is running on iheza.online
- Check server logs for errors
- Verify network connectivity to the backend

### If you still get 401 error:
- Double-check the password is correct (`DLP00000`)
- Verify the user exists in the production database
- Check if the user status is "active"
- Verify the access code format matches exactly: `DLP/PRINCIPAL/0001/2024`

### If the API call fails:
- Verify your admin token is valid
- Check if you have permission to create users (director or coordinator role)
- Verify the API endpoint is correct: `https://iheza.online/api/users`

## Prevention for Future

To prevent this issue in the future:

1. **Database Synchronization**: Implement a process to sync user changes from development to production
2. **Import Script Maintenance**: Always update `import_staff.py` when adding new users in development
3. **Documentation**: Document all user accounts and their credentials
4. **Testing**: Test login for all users after deployment to production