# How to Update the Live Site Password

The password is NOT hardcoded in the code. It's stored as a bcrypt hash in the MongoDB database on the production server.

## To update the live site password:

### Option 1: Run the update script on the production server

1. SSH into the production server:
   ```bash
   ssh user@iheza.online
   ```

2. Copy the update script to the server:
   ```bash
   scp backend/update_principal_password.py user@iheza.online:/path/to/backend/
   ```

3. Run the script:
   ```bash
   cd /path/to/backend
   python update_principal_password.py
   ```

### Option 2: Update directly in MongoDB

1. SSH into the production server and connect to MongoDB:
   ```bash
   mongosh
   ```

2. Switch to the production database and update the password hash:
   ```javascript
   use your_database_name
   
   // Generate the new bcrypt hash
   // Then update the user
   db.users.updateOne(
     { access_code: "DUP/PRINCIPAL/0002/2021" },
     { $set: { password_hash: "THE_NEW_BCRYPT_HASH_HERE" } }
   )
   ```

### Option 3: Re-run import_staff.py on production

```bash
cd /path/to/backend
python import_staff.py
```
**WARNING**: This will delete ALL existing users and re-import them.

## Verify the update

After updating, test the login:
- Access Code: `DUP/PRINCIPAL/0002/2021`
- Password: `DUP00000`
- Portal: Principal

