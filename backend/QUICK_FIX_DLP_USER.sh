#!/bin/bash
# QUICK FIX for DLP User Login Issue
# Run this on the PRODUCTION server (iheza.online)

echo "================================================"
echo "QUICK FIX: Add DLP User to Production Database"
echo "================================================"
echo ""
echo "This script will add the DLP user to the production database."
echo "The DLP user can then log in at: https://iheza.online/chain/deniz-lower-primary-/DLP"
echo ""
echo "Credentials:"
echo "  Access Code: DLP/PRINCIPAL/0001/2024"
echo "  Password: DLP00000"
echo "  Portal: Principal"
echo ""
read -p "Press Enter to continue or Ctrl+C to cancel..."

# Generate bcrypt hash for password DLP00000
echo ""
echo "Generating password hash..."
PASSWORD_HASH=$(python3 -c "
import bcrypt
hash = bcrypt.hashpw('DLP00000'.encode('utf-8'), bcrypt.gensalt())
print(hash.decode('utf-8'))
" 2>/dev/null)

if [ -z "$PASSWORD_HASH" ]; then
    echo "Error: Could not generate password hash. Installing bcrypt..."
    pip3 install bcrypt > /dev/null 2>&1
    PASSWORD_HASH=$(python3 -c "
import bcrypt
hash = bcrypt.hashpw('DLP00000'.encode('utf-8'), bcrypt.gensalt())
print(hash.decode('utf-8'))
")
fi

echo "Password hash generated: ${PASSWORD_HASH:0:20}..."
echo ""

# MongoDB connection details (adjust as needed)
MONGO_URL="${MONGO_URL:-mongodb://localhost:27017}"
DB_NAME="${DB_NAME:-iheza_db}"

echo "Using MongoDB: $MONGO_URL"
echo "Database: $DB_NAME"
echo ""

# Check if mongosh is available
if command -v mongosh &> /dev/null; then
    echo "Using mongosh..."
    MONGOCMD="mongosh"
elif command -v mongo &> /dev/null; then
    echo "Using mongo (legacy)..."
    MONGOCMD="mongo"
else
    echo "Error: Neither mongosh nor mongo found. Please install MongoDB shell."
    exit 1
fi

# Create temporary JavaScript file
TEMP_JS=$(mktemp)
cat > "$TEMP_JS" << EOF
// Check if DLP user exists
var existing = db.users.findOne({ "access_code": "DLP/PRINCIPAL/0001/2024" });

if (existing) {
    print("DLP user already exists. Updating password...");
    db.users.updateOne(
        { "access_code": "DLP/PRINCIPAL/0001/2024" },
        { 
            \$set: {
                "first_name": "DLP",
                "last_name": "Principal",
                "name": "DLP Principal",
                "email": "principal@dlp.edu",
                "phone": "",
                "role": "principal",
                "chain": "DLP",
                "status": "active",
                "password_hash": "$PASSWORD_HASH",
                "updated_at": new Date().toISOString()
            }
        }
    );
    print("✅ Password updated!");
} else {
    print("Creating DLP user...");
    db.users.insertOne({
        "id": "dlp-principal-" + new ObjectId().toString(),
        "access_code": "DLP/PRINCIPAL/0001/2024",
        "first_name": "DLP",
        "last_name": "Principal",
        "name": "DLP Principal",
        "email": "principal@dlp.edu",
        "phone": "",
        "role": "principal",
        "chain": "DLP",
        "status": "active",
        "password_hash": "$PASSWORD_HASH",
        "created_at": new Date().toISOString(),
        "updated_at": new Date().toISOString()
    });
    print("✅ User created!");
}

// Verify
var user = db.users.findOne(
    { "access_code": "DLP/PRINCIPAL/0001/2024" },
    { "_id": 0, "password_hash": 0 }
);

if (user) {
    print("\\n✅ VERIFICATION SUCCESSFUL!");
    print("DLP user is now in the database:");
    for (var key in user) {
        print("  " + key + ": " + user[key]);
    }
} else {
    print("\\n❌ VERIFICATION FAILED!");
    print("DLP user not found in database.");
}
EOF

echo "Running MongoDB command..."
echo ""

# Execute the MongoDB command
$MONGOCMD "$MONGO_URL/$DB_NAME" "$TEMP_JS"

# Clean up
rm -f "$TEMP_JS"

echo ""
echo "================================================"
echo "QUICK FIX COMPLETED"
echo "================================================"
echo ""
echo "Next steps:"
echo "1. Go to: https://iheza.online/chain/deniz-lower-primary-/DLP"
echo "2. Click 'Principal' portal"
echo "3. Enter:"
echo "   - Access Code: DLP/PRINCIPAL/0001/2024"
echo "   - Password: DLP00000"
echo "4. Click Login"
echo ""
echo "If login still fails:"
echo "1. Check if backend server is running"
echo "2. Check server logs for errors"
echo "3. Verify the user has 'active' status in database"
echo "4. Make sure chain 'DLP' exists in chains collection"
echo ""
echo "Troubleshooting command:"
echo "  $MONGOCMD \"$MONGO_URL/$DB_NAME\" --eval \"db.users.find({access_code: 'DLP/PRINCIPAL/0001/2024'}, {_id: 0, password_hash: 0})\""
echo ""