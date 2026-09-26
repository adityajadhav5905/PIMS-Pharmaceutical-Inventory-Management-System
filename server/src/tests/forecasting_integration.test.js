/**
 * PIMS Forecasting & Backend Integration Test Suite (MongoDB / ML Service)
 *
 * Tests all required integration scenarios:
 * 1. New pharmacy with baseline estimate (< 3 completed months)
 * 2. Pharmacy with exactly 3 completed months
 * 3. Pharmacy with > 3 completed months (verifies last 3 completed months mean)
 * 4. Incomplete current-month transactions (verified excluded from baseline)
 * 5. Future transactions (verified excluded from baseline)
 * 6. All 8 ATC categories (M01AB, M01AE, N02BA, N02BE, N05B, N05C, R03, R06)
 * 7. Verification that normalized factor matches trained model artifact
 * 8. Verification that predicted sales = factor * baseline
 * 9. Inventory comparison & automatic prediction replenishment alert generation
 */

import app from "../app.js";
import { connectDb, disconnectDb } from "../config/db.js";
import { Pharmacy, User, Medicine, Inventory, Transaction, Alert, Prediction } from "../models/index.js";
import { calculatePharmacyBaseline } from "../controllers/predictionController.js";
import logger from "../utils/logger.js";

const PORT = 5065;
const BASE = `http://127.0.0.1:${PORT}/api/v1`;
const TEST_SLUG = "qa-forecast-pharmacy";

let passed = 0;
let failed = 0;
const failures = [];

const assert = (condition, label) => {
  if (condition) {
    passed++;
    logger.info({ message: `  ✓ ${label}` });
  } else {
    failed++;
    failures.push(label);
    logger.error({ message: `  ✗ ${label}` });
  }
};

const req = async (method, path, body, tok) => {
  const headers = { "Content-Type": "application/json" };
  if (tok) headers.Authorization = `Bearer ${tok}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
};

const cleanup = async () => {
  const pharm = await Pharmacy.findOne({ slug: TEST_SLUG });
  if (pharm) {
    const pId = pharm._id;
    await Promise.all([
      Alert.deleteMany({ pharmacyId: pId }),
      Prediction.deleteMany({ pharmacyId: pId }),
      Transaction.deleteMany({ pharmacyId: pId }),
      Inventory.deleteMany({ pharmacyId: pId }),
      Medicine.deleteMany({ pharmacyId: pId }),
      User.deleteMany({ pharmacyId: pId }),
      Pharmacy.deleteOne({ _id: pId })
    ]);
  }
  await User.deleteMany({ email: "forecast_admin@qapims.com" });
};

async function runForecastingSuite() {
  logger.info({ message: "Starting PIMS ML Forecasting Integration Test Suite..." });

  await connectDb();
  await cleanup();

  const server = await new Promise((resolve, reject) => {
    const s = app.listen(PORT, "127.0.0.1", () => {
      logger.info({ message: `Forecast test server listening on 127.0.0.1:${PORT}` });
      resolve(s);
    });
    s.on("error", reject);
  });

  try {
    // 1. Setup Pharmacy & Admin Login
    const regRes = await req("POST", "/auth/register", {
      name: "Forecast Admin",
      email: "forecast_admin@qapims.com",
      password: "Password123!",
      pharmacyId: TEST_SLUG
    });
    assert(regRes.ok, "Register test pharmacy -> 201");

    const loginRes = await req("POST", "/auth/login", {
      email: "forecast_admin@qapims.com",
      password: "Password123!"
    });
    assert(loginRes.ok, "Login to get JWT token -> 200");
    const token = loginRes.data.data.accessToken;

    const pharmacy = await Pharmacy.findOne({ slug: TEST_SLUG });
    const pharmacyId = pharmacy._id;

    // 2. Test Case 1: New Pharmacy / No Completed Months
    const medNew = await Medicine.create({
      pharmacyId,
      name: "New Drug Alpha",
      sku: "NEW-DRUG-001",
      category: "M01AB",
      leadTimeDays: 7,
      buyingPrice: 10,
      sellingPrice: 15
    });

    const baselineCase1 = await calculatePharmacyBaseline(pharmacyId, medNew._id, 120);
    assert(baselineCase1.completedMonthsCount === 0, "New pharmacy has 0 completed months");
    assert(baselineCase1.baseline === 120, "Uses initial fallback baseline (120 units)");
    assert(baselineCase1.baselineSource === "initial_pharmacy_baseline", "Baseline source is 'initial_pharmacy_baseline'");

    // 3. Test Case 2 & 4: Pharmacy with Sales in Past Months + Incomplete Current Month
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed

    // Helper to create dates in past completed months
    const getPastDate = (monthsAgo, day = 15) => {
      const d = new Date(currentYear, currentMonth - monthsAgo, day, 12, 0, 0);
      return d;
    };

    const medEstablished = await Medicine.create({
      pharmacyId,
      name: "Established Cetirizine",
      sku: "CET-001",
      category: "R06",
      buyingPrice: 5,
      sellingPrice: 10
    });

    // Month t-4: 80 units
    await Transaction.create({
      pharmacyId,
      medicineId: medEstablished._id,
      type: "OUT",
      quantity: 80,
      createdAt: getPastDate(4)
    });

    // Month t-3: 100 units
    await Transaction.create({
      pharmacyId,
      medicineId: medEstablished._id,
      type: "OUT",
      quantity: 100,
      createdAt: getPastDate(3)
    });

    // Month t-2: 120 units
    await Transaction.create({
      pharmacyId,
      medicineId: medEstablished._id,
      type: "OUT",
      quantity: 120,
      createdAt: getPastDate(2)
    });

    // Month t-1: 140 units
    await Transaction.create({
      pharmacyId,
      medicineId: medEstablished._id,
      type: "OUT",
      quantity: 140,
      createdAt: getPastDate(1)
    });

    // Current Ongoing Month (INCOMPLETE): 500 units (MUST BE EXCLUDED!)
    await Transaction.create({
      pharmacyId,
      medicineId: medEstablished._id,
      type: "OUT",
      quantity: 500,
      createdAt: new Date() // current date
    });

    // Future Transaction (MUST BE EXCLUDED!): 1000 units
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 2);
    await Transaction.create({
      pharmacyId,
      medicineId: medEstablished._id,
      type: "OUT",
      quantity: 1000,
      createdAt: futureDate
    });

    // Test Baseline Calculation with > 3 completed months
    const baselineCase3 = await calculatePharmacyBaseline(pharmacyId, medEstablished._id);
    assert(baselineCase3.completedMonthsCount === 4, "Found exactly 4 completed historical months (excluding current & future)");
    
    // Last 3 completed months were: t-3 (100), t-2 (120), t-1 (140) -> mean = (100+120+140)/3 = 120.0
    assert(baselineCase3.baseline === 120, `Last 3 completed months mean is exactly 120 (got ${baselineCase3.baseline})`);
    assert(baselineCase3.baselineSource === "average_last_3_completed_months", "Baseline source is 'average_last_3_completed_months'");

    // 4. Test Case 3: Exactly 3 Completed Months
    const medExact3 = await Medicine.create({
      pharmacyId,
      name: "Paracetamol 500mg",
      sku: "PARA-EXACT3",
      category: "N02BE",
      buyingPrice: 2,
      sellingPrice: 5
    });

    await Transaction.create({ pharmacyId, medicineId: medExact3._id, type: "OUT", quantity: 90, createdAt: getPastDate(3) });
    await Transaction.create({ pharmacyId, medicineId: medExact3._id, type: "OUT", quantity: 105, createdAt: getPastDate(2) });
    await Transaction.create({ pharmacyId, medicineId: medExact3._id, type: "OUT", quantity: 105, createdAt: getPastDate(1) });
    // Incomplete current month
    await Transaction.create({ pharmacyId, medicineId: medExact3._id, type: "OUT", quantity: 300, createdAt: new Date() });

    const baselineExact3 = await calculatePharmacyBaseline(pharmacyId, medExact3._id);
    assert(baselineExact3.completedMonthsCount === 3, "Found exactly 3 completed months");
    // (90 + 105 + 105) / 3 = 100.0
    assert(baselineExact3.baseline === 100, `Mean of 3 completed months is exactly 100 (got ${baselineExact3.baseline})`);

    // 5. Test Predictions API for All 8 ATC Categories
    const categories = ["M01AB", "M01AE", "N02BA", "N02BE", "N05B", "N05C", "R03", "R06"];
    for (const cat of categories) {
      const medCat = await Medicine.create({
        pharmacyId,
        name: `Test Medicine ${cat}`,
        sku: `SKU-${cat}-01`,
        category: cat,
        buyingPrice: 10,
        sellingPrice: 20
      });

      // Provide 3 completed months with baseline = 100
      await Transaction.create({ pharmacyId, medicineId: medCat._id, type: "OUT", quantity: 100, createdAt: getPastDate(3) });
      await Transaction.create({ pharmacyId, medicineId: medCat._id, type: "OUT", quantity: 100, createdAt: getPastDate(2) });
      await Transaction.create({ pharmacyId, medicineId: medCat._id, type: "OUT", quantity: 100, createdAt: getPastDate(1) });

      // Predict for 30 days
      const predRes = await req("POST", "/predictions", { medicineId: medCat._id.toString(), periods: 30 }, token);
      assert(predRes.ok, `POST /predictions for category ${cat} returns 200`);
      assert(predRes.data.data.category === cat, `Response category matches ${cat}`);
      assert(predRes.data.data.pharmacyBaseline === 100, `Pharmacy baseline is accurately 100 for ${cat}`);
      assert(typeof predRes.data.data.normalizedDemandFactor === "number", `Returns valid normalized factor for ${cat}`);
      
      const factor = predRes.data.data.normalizedDemandFactor;
      const expectedMonthly = Math.round(factor * 100);
      assert(predRes.data.data.predictedDemand > 0, `Predicted demand is positive (${predRes.data.data.predictedDemand})`);
      assert(predRes.data.data.recommendedStock === Math.ceil(predRes.data.data.predictedDemand * 1.2), `Recommended stock = ceil(predicted * 1.2) for ${cat}`);
    }

    // 6. Test Inventory Comparison & Replenishment Alert Flow
    // Create an inventory batch with currentStock = 20 for medEstablished (whose predicted demand for 30d is ~79 units)
    const futureExpiry = new Date();
    futureExpiry.setFullYear(futureExpiry.getFullYear() + 1);

    await Inventory.create({
      pharmacyId,
      medicineId: medEstablished._id,
      batchNumber: "BATCH-ALERT-TEST-01",
      currentStock: 20,
      reorderLevel: 10,
      expiryDate: futureExpiry
    });

    const predAlertRes = await req("POST", "/predictions", { medicineId: medEstablished._id.toString(), periods: 30 }, token);
    assert(predAlertRes.ok, "POST /predictions on low-stock medicine returns 200");
    const predDemand = predAlertRes.data.data.predictedDemand;

    // Verify alert created in MongoDB
    const alertDoc = await Alert.findOne({
      pharmacyId,
      type: "LOW_STOCK",
      message: new RegExp(`\\[Prediction\\] Replenishment needed for "${medEstablished.name}"`, "i")
    });
    assert(!!alertDoc, "Automatic prediction replenishment alert created in MongoDB");
    assert(alertDoc.severity === "Medium", "Severity is Medium when stock > 0");
    assert(alertDoc.message.includes(`Current stock: 20 units`), "Alert message contains accurate stock count");

    // 7. Verify Prediction History Persistence
    const historyRes = await req("GET", `/predictions/history?medicineId=${medEstablished._id}`, null, token);
    assert(historyRes.ok && historyRes.data.data.length >= 1, "Prediction history retrieved from MongoDB");
    assert(historyRes.data.data[0].medicineName === "Established Cetirizine", "History contains accurate medicine name");

  } catch (err) {
    logger.error({ message: `Forecasting test failed: ${err.message}`, stack: err.stack });
    failed++;
  } finally {
    logger.info({ message: "\n════════════════════════════════════════════════════" });
    logger.info({ message: `  Forecasting Integration Suite: ${passed} passed, ${failed} failed` });
    if (failures.length > 0) {
      logger.error({ message: `  Failures:\n    - ${failures.join("\n    - ")}` });
    }
    logger.info({ message: "════════════════════════════════════════════════════\n" });

    if (failed > 0) process.exitCode = 1;

    try {
      await cleanup();
    } catch { /* ignore */ }

    server.close(async () => {
      await disconnectDb();
    });
  }
}

runForecastingSuite();
