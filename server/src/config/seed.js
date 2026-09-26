import bcrypt from "bcryptjs";
import { connectDb, disconnectDb } from "./db.js";
import logger from "../utils/logger.js";
import {
  Pharmacy,
  User,
  Staff,
  Medicine,
  Inventory,
  Transaction,
  Alert,
  Prediction,
  UserPreference,
  SupportTicket
} from "../models/index.js";

async function seed() {
  logger.info({ message: "Connecting to MongoDB for seeding multi-tenant data..." });
  await connectDb();

  logger.info({ message: "Clearing existing MongoDB collections..." });
  await Promise.all([
    Pharmacy.deleteMany({}),
    User.deleteMany({}),
    Staff.deleteMany({}),
    Medicine.deleteMany({}),
    Inventory.deleteMany({}),
    Transaction.deleteMany({}),
    Alert.deleteMany({}),
    Prediction.deleteMany({}),
    UserPreference.deleteMany({}),
    SupportTicket.deleteMany({})
  ]);

  const passwordHash = await bcrypt.hash("ChangeMe123!", 10);
  const today = new Date();

  const pharmaciesData = [
    {
      slug: "default-pharmacy",
      name: "Default Pharmacy",
      address: "123 Health Ave, Clinic District",
      phone: "+91 99999 88888",
      adminEmail: "admin@hospital.com",
      adminName: "System Admin 1",
      staff: [
        { name: "Jane Doe", email: "jane@hospital.com", position: "Senior Pharmacist", department: "Dispensing", salary: 65000, joinDate: new Date("2025-01-15"), totalSales: 1160.0 },
        { name: "John Smith", email: "john@hospital.com", position: "Staff Pharmacist", department: "Dispensing", salary: 45000, joinDate: new Date("2025-03-01"), totalSales: 250.0 },
        { name: "Bob Miller", email: "bob@hospital.com", position: "Inventory Supervisor", department: "Store Room", salary: 50000, joinDate: new Date("2025-02-10"), totalSales: 400.0 },
        { name: "Alice Green", email: "alice@hospital.com", position: "Pharmacy Technician", department: "Dispensing", salary: 32000, joinDate: new Date("2025-05-20"), totalSales: 0.0 }
      ],
      medicines: [
        { sku: "MED-001", name: "Paracetamol", brand: "Crocin", description: "500mg pain relief tablet", category: "Analgesic", supplier: "GlaxoSmithKline", buyingPrice: 2.5, sellingPrice: 5.0, leadTimeDays: 5 },
        { sku: "MED-002", name: "Amoxicillin", brand: "Mox", description: "250mg antibiotic capsule", category: "Antibiotic", supplier: "Sun Pharma", buyingPrice: 8.0, sellingPrice: 15.0, leadTimeDays: 8 },
        { sku: "MED-003", name: "Ibuprofen", brand: "Advil", description: "400mg NSAID anti-inflammatory", category: "Analgesic", supplier: "Pfizer", buyingPrice: 3.0, sellingPrice: 5.0, leadTimeDays: 4 },
        { sku: "MED-004", name: "Metformin", brand: "Glucophage", description: "500mg anti-diabetic tablet", category: "Antidiabetic", supplier: "Merck", buyingPrice: 5.0, sellingPrice: 8.0, leadTimeDays: 6 },
        { sku: "MED-005", name: "Atorvastatin", brand: "Lipitor", description: "10mg cholesterol lowering statin", category: "Cardiovascular", supplier: "Viatris", buyingPrice: 10.0, sellingPrice: 18.0, leadTimeDays: 7 },
        { sku: "MED-006", name: "Lisinopril", brand: "Zestril", description: "5mg blood pressure ACE inhibitor", category: "Cardiovascular", supplier: "AstraZeneca", buyingPrice: 4.0, sellingPrice: 7.5, leadTimeDays: 5 },
        { sku: "MED-007", name: "Albuterol", brand: "ProAir", description: "Inhaler for asthma bronchospasms", category: "Respiratory", supplier: "Teva", buyingPrice: 15.0, sellingPrice: 25.0, leadTimeDays: 10 },
        { sku: "MED-008", name: "Omeprazole", brand: "Prilosec", description: "20mg acid reflux capsule", category: "Gastrointestinal", supplier: "Procter & Gamble", buyingPrice: 3.5, sellingPrice: 6.0, leadTimeDays: 6 }
      ],
      batches: [
        { medSku: "MED-001", batchNumber: "BATCH-PAR-01", currentStock: 400, reorderLevel: 50, expiryOffsetDays: 180 },
        { medSku: "MED-001", batchNumber: "BATCH-PAR-02", currentStock: 50, reorderLevel: 50, expiryOffsetDays: -5 },
        { medSku: "MED-002", batchNumber: "BATCH-AMO-01", currentStock: 12, reorderLevel: 25, expiryOffsetDays: 45 },
        { medSku: "MED-003", batchNumber: "BATCH-IBU-01", currentStock: 220, reorderLevel: 40, expiryOffsetDays: 90 },
        { medSku: "MED-004", batchNumber: "BATCH-MET-01", currentStock: 180, reorderLevel: 30, expiryOffsetDays: 8 },
        { medSku: "MED-005", batchNumber: "BATCH-ATO-01", currentStock: 500, reorderLevel: 60, expiryOffsetDays: 200 },
        { medSku: "MED-006", batchNumber: "BATCH-LIS-01", currentStock: 0, reorderLevel: 30, expiryOffsetDays: 120 },
        { medSku: "MED-007", batchNumber: "BATCH-ALB-01", currentStock: 80, reorderLevel: 15, expiryOffsetDays: 22 },
        { medSku: "MED-008", batchNumber: "BATCH-OME-01", currentStock: 110, reorderLevel: 20, expiryOffsetDays: 150 }
      ]
    },
    {
      slug: "apex-pharmacy",
      name: "Apex Pharmacy",
      address: "456 Apex Plaza, Commercial Sector",
      phone: "+91 88888 77777",
      adminEmail: "admin2@hospital.com",
      adminName: "System Admin 2",
      staff: [
        { name: "Emily Watson", email: "emily@apex.com", position: "Senior Pharmacist", department: "Dispensing", salary: 68000, joinDate: new Date("2025-01-20"), totalSales: 1300.0 },
        { name: "Jack Davis", email: "jack@apex.com", position: "Staff Pharmacist", department: "Dispensing", salary: 47000, joinDate: new Date("2025-03-05"), totalSales: 300.0 },
        { name: "Sarah Connor", email: "sarah@apex.com", position: "Inventory Supervisor", department: "Store Room", salary: 52000, joinDate: new Date("2025-02-15"), totalSales: 500.0 },
        { name: "Tom Harris", email: "tom@apex.com", position: "Pharmacy Technician", department: "Dispensing", salary: 34000, joinDate: new Date("2025-05-25"), totalSales: 0.0 }
      ],
      medicines: [
        { sku: "MED-P2-001", name: "Aspirin", brand: "Disprin", description: "325mg pain relief tablet", category: "Analgesic", supplier: "Bayer", buyingPrice: 1.5, sellingPrice: 3.5, leadTimeDays: 5 },
        { sku: "MED-P2-002", name: "Ciprofloxacin", brand: "Ciplox", description: "500mg broad spectrum antibiotic", category: "Antibiotic", supplier: "Cipla", buyingPrice: 12.0, sellingPrice: 22.0, leadTimeDays: 7 },
        { sku: "MED-P2-003", name: "Naproxen", brand: "Aleve", description: "220mg NSAID pain killer", category: "Analgesic", supplier: "Bayer", buyingPrice: 4.0, sellingPrice: 7.0, leadTimeDays: 6 },
        { sku: "MED-P2-004", name: "Glipizide", brand: "Glucotrol", description: "5mg type 2 diabetes treatment", category: "Antidiabetic", supplier: "Pfizer", buyingPrice: 6.0, sellingPrice: 10.0, leadTimeDays: 5 }
      ],
      batches: [
        { medSku: "MED-P2-001", batchNumber: "BATCH-ASP-01", currentStock: 350, reorderLevel: 50, expiryOffsetDays: 140 },
        { medSku: "MED-P2-002", batchNumber: "BATCH-CIP-01", currentStock: 8, reorderLevel: 20, expiryOffsetDays: 15 },
        { medSku: "MED-P2-003", batchNumber: "BATCH-NAP-01", currentStock: 150, reorderLevel: 30, expiryOffsetDays: 180 },
        { medSku: "MED-P2-004", batchNumber: "BATCH-GLI-01", currentStock: 75, reorderLevel: 25, expiryOffsetDays: 90 }
      ]
    },
    {
      slug: "city-care-pharmacy",
      name: "City Care Pharmacy",
      address: "789 Metro Hub, Downtown",
      phone: "+91 77777 66666",
      adminEmail: "admin3@hospital.com",
      adminName: "System Admin 3",
      staff: [
        { name: "Michael Chang", email: "michael@citycare.com", position: "Senior Pharmacist", department: "Dispensing", salary: 66000, joinDate: new Date("2025-01-10"), totalSales: 800.0 }
      ],
      medicines: [
        { sku: "MED-P3-001", name: "Cetirizine", brand: "Zyrtec", description: "10mg allergy relief antihistamine", category: "Antihistamine", supplier: "J&J", buyingPrice: 1.8, sellingPrice: 4.0, leadTimeDays: 4 },
        { sku: "MED-P3-002", name: "Pantoprazole", brand: "Protonix", description: "40mg proton pump inhibitor", category: "Gastrointestinal", supplier: "Pfizer", buyingPrice: 4.5, sellingPrice: 8.5, leadTimeDays: 5 }
      ],
      batches: [
        { medSku: "MED-P3-001", batchNumber: "BATCH-CET-01", currentStock: 200, reorderLevel: 30, expiryOffsetDays: 200 },
        { medSku: "MED-P3-002", batchNumber: "BATCH-PAN-01", currentStock: 15, reorderLevel: 25, expiryOffsetDays: 5 }
      ]
    }
  ];

  for (const pData of pharmaciesData) {
    logger.info({ message: `Seeding pharmacy: ${pData.name} (${pData.slug})...` });

    // 1. Create Pharmacy
    const pharmacy = await Pharmacy.create({
      slug: pData.slug,
      name: pData.name,
      address: pData.address,
      phone: pData.phone,
      email: pData.adminEmail
    });

    // 2. Create Admin User
    await User.create({
      pharmacyId: pharmacy._id,
      name: pData.adminName,
      email: pData.adminEmail.toLowerCase().trim(),
      password: passwordHash,
      role: "Admin"
    });

    // Create Admin Staff Entry
    await Staff.create({
      pharmacyId: pharmacy._id,
      name: pData.adminName,
      email: pData.adminEmail.toLowerCase().trim(),
      position: "System Admin",
      department: "Management",
      salary: 100000,
      joinDate: new Date("2025-01-01"),
      totalSales: 0,
      status: "Active"
    });

    // 3. Create Staff & Staff User accounts
    const staffDocs = [];
    for (const s of pData.staff) {
      const staffDoc = await Staff.create({
        pharmacyId: pharmacy._id,
        name: s.name,
        email: s.email.toLowerCase().trim(),
        position: s.position,
        department: s.department,
        salary: s.salary,
        joinDate: s.joinDate,
        totalSales: s.totalSales,
        status: "Active"
      });
      staffDocs.push(staffDoc);

      await User.create({
        pharmacyId: pharmacy._id,
        name: s.name,
        email: s.email.toLowerCase().trim(),
        password: passwordHash,
        role: "Pharmacist"
      });
    }

    // 4. Create Medicines
    const medMap = new Map();
    for (const m of pData.medicines) {
      const medDoc = await Medicine.create({
        pharmacyId: pharmacy._id,
        sku: m.sku,
        name: m.name,
        brand: m.brand,
        description: m.description,
        category: m.category,
        supplier: m.supplier,
        buyingPrice: m.buyingPrice,
        sellingPrice: m.sellingPrice,
        leadTimeDays: m.leadTimeDays,
        isActive: true
      });
      medMap.set(m.sku, medDoc);
    }

    // 5. Create Inventory Batches, Transactions & Alerts
    for (const b of pData.batches) {
      const med = medMap.get(b.medSku);
      if (!med) continue;

      const expiryDate = new Date(today);
      expiryDate.setDate(expiryDate.getDate() + b.expiryOffsetDays);

      const batchDoc = await Inventory.create({
        pharmacyId: pharmacy._id,
        medicineId: med._id,
        batchNumber: b.batchNumber,
        currentStock: b.currentStock,
        reorderLevel: b.reorderLevel,
        expiryDate
      });

      // Create IN transaction
      await Transaction.create({
        pharmacyId: pharmacy._id,
        medicineId: med._id,
        inventoryId: batchDoc._id,
        type: "IN",
        quantity: b.currentStock + 50,
        unitBuyPrice: med.buyingPrice,
        unitSellPrice: med.sellingPrice,
        totalCost: (b.currentStock + 50) * med.buyingPrice,
        totalRevenue: 0,
        profit: 0,
        note: "Initial stock intake"
      });

      // If low stock or expired, create alert
      if (b.currentStock <= b.reorderLevel) {
        await Alert.create({
          pharmacyId: pharmacy._id,
          inventoryId: batchDoc._id,
          type: "LOW_STOCK",
          message: `${med.name} (Batch: ${b.batchNumber}) is below reorder level. Current stock: ${b.currentStock} units.`,
          severity: b.currentStock === 0 ? "High" : "Medium",
          isResolved: false
        });
      }

      if (b.expiryOffsetDays <= 30) {
        await Alert.create({
          pharmacyId: pharmacy._id,
          inventoryId: batchDoc._id,
          type: "EXPIRY_WARNING",
          message: `${med.name} batch ${b.batchNumber} is expiring in ${b.expiryOffsetDays} days.`,
          severity: b.expiryOffsetDays <= 7 ? "High" : "Medium",
          isResolved: b.expiryOffsetDays < 0
        });
      }
    }

    // Create a sample OUT transaction with staff 1
    if (staffDocs.length > 0 && pData.medicines.length > 0) {
      const sampleMed = medMap.get(pData.medicines[0].sku);
      await Transaction.create({
        pharmacyId: pharmacy._id,
        medicineId: sampleMed._id,
        type: "OUT",
        quantity: 10,
        unitBuyPrice: sampleMed.buyingPrice,
        unitSellPrice: sampleMed.sellingPrice,
        totalCost: 10 * sampleMed.buyingPrice,
        totalRevenue: 10 * sampleMed.sellingPrice,
        profit: 10 * (sampleMed.sellingPrice - sampleMed.buyingPrice),
        employeeId: staffDocs[0]._id,
        note: "Prescription fill sale"
      });
    }
  }

  logger.info({ message: "Multi-tenant MongoDB seeding completed successfully!" });
}

seed()
  .then(async () => {
    await disconnectDb();
    process.exit(0);
  })
  .catch(async (err) => {
    logger.error({ message: `Seeding failed: ${err.message}`, stack: err.stack });
    await disconnectDb();
    process.exit(1);
  });
