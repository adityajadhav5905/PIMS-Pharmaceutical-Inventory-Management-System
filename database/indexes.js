/* eslint-disable no-console */
const dotenv = require("../server/node_modules/dotenv");
const mongoose = require("../server/node_modules/mongoose");
const path = require("path");

dotenv.config({ path: path.resolve(__dirname, "..", ".env"), override: true });

async function run() {
  const mongoUri =
    process.env.MONGO_URI?.includes("mongo:27017") && process.env.NODE_ENV !== "production"
      ? "mongodb://127.0.0.1:27017/medical_inventory"
      : process.env.MONGO_URI;

  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;

  await db.collection("medicines").createIndex({ name: 1 });
  await db.collection("inventories").createIndex({ expiryDate: 1 });
  await db.collection("inventories").createIndex({ currentStock: 1 });
  await db.collection("inventories").createIndex({ createdAt: -1, updatedAt: -1 });
  await db.collection("transactions").createIndex({ createdAt: -1 });
  await db.collection("alerts").createIndex({ createdAt: -1 });

  console.log("Indexes created");
  await mongoose.disconnect();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
