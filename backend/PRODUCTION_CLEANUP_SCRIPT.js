// ============================================================
// IHEZA Production Database Cleanup Script
// Run this in MongoDB Compass Shell or mongosh
// ============================================================
// 
// CONNECTION STRING:
// mongodb+srv://build-app-now-34:d73em5klqs2c73c1psf0@customer-apps.hfcqut.mongodb.net/build-app-now-34-test_database
//
// HOW TO RUN:
// 1. Open MongoDB Compass
// 2. Connect using the connection string above
// 3. Click on "MONGOSH" at the bottom of the window
// 4. Copy and paste the commands below one section at a time
// ============================================================

// Switch to your database
use("build-app-now-34-test_database");

// ============================================================
// 1. CLEAN PAYMENTS - Remove receipt images
// ============================================================
print("Cleaning payments collection...");
var result1 = db.payments.updateMany(
  { receipt_image: { $exists: true, $ne: null } },
  { $unset: { receipt_image: "" } }
);
print("  Removed receipt_image from " + result1.modifiedCount + " records");

var result1b = db.payments.updateMany(
  { receipt_images: { $exists: true } },
  { $unset: { receipt_images: "" } }
);
print("  Removed receipt_images from " + result1b.modifiedCount + " records");

// ============================================================
// 2. CLEAN ADMISSIONS - Remove passport photos
// ============================================================
print("\nCleaning admissions collection...");
var result2 = db.admissions.updateMany(
  { passport_photo: { $exists: true, $ne: null } },
  { $unset: { passport_photo: "" } }
);
print("  Removed passport_photo from " + result2.modifiedCount + " records");

// ============================================================
// 3. CLEAN STUDENTS - Remove base64 images
// ============================================================
print("\nCleaning students collection...");
var result3 = db.students.updateMany(
  { $or: [
    { passport_photo: { $exists: true, $ne: null } },
    { profile_pic: { $exists: true, $ne: null } }
  ]},
  { $unset: { passport_photo: "", profile_pic: "" } }
);
print("  Removed images from " + result3.modifiedCount + " students");

// ============================================================
// 4. CLEAN USERS - Remove profile pics
// ============================================================
print("\nCleaning users collection...");
var result4 = db.users.updateMany(
  { profile_pic: { $exists: true, $ne: null } },
  { $unset: { profile_pic: "" } }
);
print("  Removed profile_pic from " + result4.modifiedCount + " users");

// ============================================================
// 5. CLEAN DOCUMENTS - Remove base64 data
// ============================================================
print("\nCleaning documents collection...");
var result5 = db.documents.updateMany(
  { data: { $exists: true, $ne: null } },
  { $unset: { data: "" } }
);
print("  Removed data from " + result5.modifiedCount + " documents");

// ============================================================
// SUMMARY
// ============================================================
var total = result1.modifiedCount + result1b.modifiedCount + result2.modifiedCount + result3.modifiedCount + result4.modifiedCount + result5.modifiedCount;
print("\n============================================================");
print("CLEANUP COMPLETE! Total records modified: " + total);
print("============================================================");
print("\nYour database should now use significantly less memory.");
print("The 502/520 errors should stop after this cleanup.");
