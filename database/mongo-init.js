/* eslint-disable no-console */
const dotenv = require("../server/node_modules/dotenv");
const mongoose = require("../server/node_modules/mongoose");
const bcrypt = require("../server/node_modules/bcryptjs");
const path = require("path");

dotenv.config({ path: path.resolve(__dirname, "..", ".env"), override: true });

async function run() {
  const mongoUri =
    process.env.MONGO_URI?.includes("mongo:27017") && process.env.NODE_ENV !== "production"
      ? "mongodb://127.0.0.1:27017/medical_inventory"
      : process.env.MONGO_URI;

  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;

  await db.createCollection("users");
  await db.createCollection("medicines");
  await db.createCollection("inventories");
  await db.createCollection("transactions");
  await db.createCollection("alerts");
  await db.createCollection("predictions");

  const password = await bcrypt.hash("ChangeMe123!", 10);
  await db.collection("users").updateOne(
    { email: "admin@hospital.com" },
    {
      $set: {
        name: "System Admin",
        password,
        role: "Admin",
        updatedAt: new Date()
      },
      $setOnInsert: {
        email: "admin@hospital.com",
        createdAt: new Date()
      }
    },
    { upsert: true }
  );

  console.log("Mongo init complete");
  await mongoose.disconnect();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
