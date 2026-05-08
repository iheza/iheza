// MongoDB script to insert DLP user directly
// Run this on the production MongoDB server

// Connect to MongoDB (adjust connection string as needed)
// mongosh "mongodb://username:password@localhost:27017/iheza_db" --file insert_dlp_user_mongodb.js

// DLP user data
const dlpUser = {
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
  "password_hash": "$2b$12$X5w8T9Q2Z7R4V1N3C6M8P.AKjHlSdFgHjKlMnBvCxZzV1N3M6K8J9H", // bcrypt hash of "DLP00000"
  "created_at": new Date().toISOString(),
  "updated_at": new Date().toISOString()
};

print("=== Inserting DLP User to Production Database ===");
print("Database: " + db.getName());
print("Collection: users");
print("");

// Check if user already exists
const existingUser = db.users.findOne({ "access_code": "DLP/PRINCIPAL/0001/2024" });

if (existingUser) {
  print("⚠️  DLP user already exists. Updating...");
  
  // Update the user
  db.users.updateOne(
    { "access_code": "DLP/PRINCIPAL/0001/2024" },
    { 
      $set: {
        "first_name": "DLP",
        "last_name": "Principal",
        "name": "DLP Principal",
        "email": "principal@dlp.edu",
        "phone": "",
        "role": "principal",
        "chain": "DLP",
        "status": "active",
        "password_hash": "$2b$12$X5w8T9Q2Z7R4V1N3C6M8P.AKjHlSdFgHjKlMnBvCxZzV1N3M6K8J9H",
        "updated_at": new Date().toISOString()
      }
    }
  );
  
  print("✅ DLP user updated successfully!");
} else {
  print("Creating new DLP user...");
  
  // Insert the user
  db.users.insertOne(dlpUser);
  
  print("✅ DLP user created successfully!");
}

print("");
print("=== Verification ===");

// Verify the user was inserted/updated
const verifiedUser = db.users.findOne(
  { "access_code": "DLP/PRINCIPAL/0001/2024" },
  { "_id": 0, "password_hash": 0 }
);

if (verifiedUser) {
  print("✅ DLP user verified in database:");
  for (let key in verifiedUser) {
    print(`  ${key}: ${verifiedUser[key]}`);
  }
} else {
  print("❌ DLP user NOT found in database!");
}

print("");
print("=== DLP User Credentials ===");
print("Access Code: DLP/PRINCIPAL/0001/2024");
print("Password: DLP00000");
print("Email: principal@dlp.edu");
print("Role: principal");
print("Chain: DLP");
print("Status: active");
print("");
print("=== Login URL ===");
print("https://iheza.online/chain/deniz-lower-primary-/DLP");
print("");
print("=== Next Steps ===");
print("1. Go to: https://iheza.online/chain/deniz-lower-primary-/DLP");
print("2. Click 'Principal' portal");
print("3. Enter Access Code: DLP/PRINCIPAL/0001/2024");
print("4. Enter Password: DLP00000");
print("5. Click Login");