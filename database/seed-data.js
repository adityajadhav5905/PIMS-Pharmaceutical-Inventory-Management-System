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

  // Clear old seed data for a clean re-seed
  await db.collection("medicines").deleteMany({});
  await db.collection("inventories").deleteMany({});
  await db.collection("transactions").deleteMany({ note: { $in: ["Initial stock", "Stock added", "Ward issue"] } });

  const meds = await db.collection("medicines").insertMany([
    {
      name: "Paracetamol",
      sku: "MED-001",
      brand: "Crocin",
      description: "500mg pain relief tablet",
      category: "Pain Relief",
      supplier: "MediSupply",
      buyingPrice: 2.5,
      sellingPrice: 5,
      leadTimeDays: 5,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      name: "Amoxicillin",
      sku: "MED-002",
      brand: "Mox",
      description: "250mg antibiotic capsule",
      category: "Antibiotic",
      supplier: "CarePharma",
      buyingPrice: 8,
      sellingPrice: 15,
      leadTimeDays: 8,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ]);

  const medicineIds = Object.values(meds.insertedIds);
  await db.collection("inventories").insertMany([
    {
      medicine: medicineIds[0],
      batchNumber: "BATCH-PAR-01",
      currentStock: 40,
      reorderLevel: 30,
      expiryDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 120),
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      medicine: medicineIds[1],
      batchNumber: "BATCH-AMO-01",
      currentStock: 15,
      reorderLevel: 25,
      expiryDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 45),
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ]);

  await db.collection("transactions").insertMany([
    {
      medicine: medicineIds[0],
      quantity: 100,
      type: "IN",
      unitBuyPrice: 2.5,
      unitSellPrice: 5,
      totalCost: 250,
      totalRevenue: 0,
      profit: 0,
      note: "Initial stock",
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      medicine: medicineIds[1],
      quantity: 20,
      type: "OUT",
      unitBuyPrice: 8,
      unitSellPrice: 15,
      totalCost: 160,
      totalRevenue: 300,
      profit: 140,
      note: "Ward issue",
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ]);

  console.log("Seed complete");
  await mongoose.disconnect();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
