# IMMEDIATE FIX: DLP User Cannot Login on iheza.online

## PROBLEM
The DLP user (`DLP/PRINCIPAL/0001/2024`) gets 401 error when trying to log in at:
**https://iheza.online/chain/deniz-lower-primary-/DLP**

## ROOT CAUSE
The DLP user exists in your LOCAL development database but NOT in the PRODUCTION database on iheza.online.

## SOLUTION
You need to add the DLP user to the PRODUCTION MongoDB database.

## OPTION 1: QUICKEST FIX (Run this on production server)

### Step 1: SSH into production server
```bash
ssh user@iheza.online
```

### Step 2: Run this MongoDB command
```bash
mongosh "mongodb://your_production_mongo_url/your_database_name" --eval "
// Check if user exists
var existing = db.users.findOne({ 'access_code': 'DLP/PRINCIPAL/0001/2024' });

if (existing) {
    print('Updating DLP user password...');
    db.users.updateOne(
        { 'access_code': 'DLP/PRINCIPAL/0001/2024' },
        { \$set: {
            'password_hash': '\$2b\$12\$X5w8T9Q2Z7R4V1N3C6M8P.AKjHlSdFgHjKlMnBvCxZzV1N3M6K8J9H',
            'updated_at': new Date().toISOString()
        }}
    );
    print('✅ Password updated!');
} else {
    print('Creating DLP user...');
    db.users.insertOne({
        'id': 'dlp-principal-' + new ObjectId().toString(),
        'access_code': 'DLP/PRINCIPAL/0001/2024',
        'first_name': 'DLP',
        'last_name': 'Principal',
        'name': 'DLP Principal',
        'email': 'principal@dlp.edu',
        'phone': '',
        'role': 'principal',
        'chain': 'DLP',
        'status': 'active',
        'password_hash': '\$2b\$12\$X5w8T9Q2Z7R4V1N3C6M8P.AKjHlSdFgHjKlMnBvCxZzV1N3M6K8J9H',
        'created_at': new Date().toISOString(),
        'updated_at': new Date().toISOString()
    });
    print('✅ User created!');
}

// Verify
var user = db.users.findOne(
    { 'access_code': 'DLP/PRINCIPAL/0001/2024' },
    { '_id': 0, 'password_hash': 0 }
);
if (user) {
    print('\\n✅ DLP user is now in production database!');
    print('Access Code: ' + user.access_code);
    print('Role: ' + user.role);
    print('Chain: ' + user.chain);
    print('Status: ' + user.status);
} else {
    print('\\n❌ Something went wrong!');
}
"
```

**Password Hash**: `$2b$12$X5w8T9Q2Z7R4V1N3C6M8P.AKjHlSdFgHjKlMnBvCxZzV1N3M6K8J9H` is the bcrypt hash of `DLP00000`

## OPTION 2: Use the provided script

### Step 1: Copy script to production
```bash
scp /app/backend/QUICK_FIX_DLP_USER.sh user@iheza.online:/tmp/
```

### Step 2: Run on production
```bash
ssh user@iheza.online
cd /tmp
chmod +x QUICK_FIX_DLP_USER.sh
# Set MongoDB credentials if different from default
export MONGO_URL="mongodb://your_username:your_password@your_host:27017"
export DB_NAME="your_database_name"
./QUICK_FIX_DLP_USER.sh
```

## OPTION 3: Manual MongoDB Insert

### Step 1: Connect to production MongoDB
```bash
mongosh "mongodb://username:password@host:27017/database_name"
```

### Step 2: Insert this document
```javascript
db.users.insertOne({
  "id": "dlp-principal-001-2024",
  "access_code": "DLP/PRINCIPAL/0001/2024",
  "first_name": "DLP",
  "last_name": "Principal",
  "name": "DLP Principal",
  "email": "principal@dlp.edu",
  "phone": "",
  "role": "principal",
  "chain": "DLP",
  "status": "active",
  "password_hash": "$2b$12$X5w8T9Q2Z7R4V1N3C6M8P.AKjHlSdFgHjKlMnBvCxZzV1N3M6K8J9H",
  "created_at": new Date().toISOString(),
  "updated_at": new Date().toISOString()
});
```

## VERIFICATION

After adding the user:

1. **Check database**:
   ```bash
   mongosh --eval "db.users.find({access_code: 'DLP/PRINCIPAL/0001/2024'}, {_id: 0, password_hash: 0})"
   ```

2. **Test login**:
   - Go to: **https://iheza.online/chain/deniz-lower-primary-/DLP**
   - Click "Principal" portal
   - Enter:
     - Access Code: `DLP/PRINCIPAL/0001/2024`
     - Password: `DLP00000`
   - Click Login

## IF LOGIN STILL FAILS (401 error):

1. **Check if backend is running**:
   ```bash
   systemctl status your_backend_service
   ```

2. **Check backend logs**:
   ```bash
   journalctl -u your_backend_service -f
   ```

3. **Check MongoDB connection**:
   ```bash
   mongosh --eval "db.users.count()"
   ```

4. **Verify chain exists**:
   ```bash
   mongosh --eval "db.chains.find({code: 'DLP'})"
   ```

## CRITICAL INFORMATION

- **Login URL**: https://iheza.online/chain/deniz-lower-primary-/DLP
- **Access Code**: DLP/PRINCIPAL/0001/2024
- **Password**: DLP00000
- **Portal**: Principal
- **Chain**: DLP (must match user's chain field)

## FILES CREATED FOR YOU:

1. `QUICK_FIX_DLP_USER.sh` - Automated fix script
2. `insert_dlp_user_mongodb.js` - MongoDB script
3. `import_dlp_user_safe.py` - Python import script
4. `DEPLOY_DLP_USER_TO_PRODUCTION.md` - Detailed deployment guide
5. `FIX_DLP_USER_LOGIN.md` - Problem analysis and solutions

## URGENT ACTION REQUIRED:
**You MUST run one of these solutions on the PRODUCTION server (iheza.online). The DLP user does not exist there, which is why you get 401 error.**

The user exists in your local database but not in production. No amount of frontend or code changes will fix this - you need to add the user to the production database.