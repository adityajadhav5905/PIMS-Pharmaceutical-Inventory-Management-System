/**
 * PIMS Complete QA End-to-End Verification Test Suite (MongoDB / Mongoose)
 *
 * Covers all 13 core operational areas:
 *   1. New Pharmacy Registration & Admin Creation
 *   2. Login, Session, Refresh Tokens (httpOnly Cookie), Logout & Expiry
 *   3. Multi-Tenant Data Isolation (Pharmacy A vs Pharmacy B)
 *   4. Admin / Pharmacist Role-Based Access Control (RBAC)
 *   5. Medicine + Inventory Batch Management & Constraints
 *   6. Stock Sales, Overselling Rejection, Expiry Block & Concurrency
 *   7. Staff Management & Automatic Login Identity Synchronization
 *   8. Automated Alerts & Strategy Deduplication
 *   9. Dashboard Statistics, Financials & CSV Exports
 *  10. Time-Series Predictions & Deterministic Forecast Engine
 *  11. User Profile, Password, Preferences & Support Ticketing
 *  12. Edge Cases, Malformed IDs & Error Handling
 *  13. Seeded Database & Demo Accounts
 */

import app from "../app.js";
import { connectDb, disconnectDb } from "../config/db.js";
import logger from "../utils/logger.js";
import { checkAlertsForBatch } from "../jobs/alertJob.js";
import { emailService, MockEmailProvider } from "../services/emailService.js";
import bcrypt from "bcryptjs";
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
  SupportTicket,
  Otp
} from "../models/index.js";

const PORT = 5055;
const BASE = `http://127.0.0.1:${PORT}/api/v1`;

const TENANT_A_SLUG = "qa-pharmacy-a";
const TENANT_B_SLUG = "qa-pharmacy-b";

let server;
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

const section = (name) => logger.info({ message: `\n══ ${name} ══` });

const req = async (method, path, body, tok, cookie) => {
  const headers = { "Content-Type": "application/json" };
  if (tok) headers.Authorization = `Bearer ${tok}`;
  if (cookie) headers.Cookie = cookie;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const contentType = res.headers.get("content-type") || "";
  let data = {};
  if (contentType.includes("application/json")) {
    data = await res.json().catch(() => ({}));
  } else if (contentType.includes("text/csv") || contentType.includes("text/plain")) {
    data = await res.text().catch(() => "");
  }
  const setCookie = res.headers.get("set-cookie") || "";
  return { status: res.status, ok: res.ok, data, headers: res.headers, setCookie };
};

const cleanTenant = async (slug) => {
  const pharmacy = await Pharmacy.findOne({ slug });
  if (pharmacy) {
    const pId = pharmacy._id;
    await Promise.all([
      SupportTicket.deleteMany({ pharmacyId: pId }),
      Prediction.deleteMany({ pharmacyId: pId }),
      Alert.deleteMany({ pharmacyId: pId }),
      Transaction.deleteMany({ pharmacyId: pId }),
      Inventory.deleteMany({ pharmacyId: pId }),
      Staff.deleteMany({ pharmacyId: pId }),
      Medicine.deleteMany({ pharmacyId: pId }),
      User.deleteMany({ pharmacyId: pId }),
      Pharmacy.deleteOne({ _id: pId })
    ]);
  }
  await User.deleteMany({
    email: { $in: ["admin_a@qapims.com", "admin_b@qapims.com", "sarah_pharmacist@qapims.com", "staff_two@qapims.com", "different_email@qapims.com"] }
  });
  await Otp.deleteMany({});
};

async function runQaVerificationSuite() {
  logger.info({ message: "Starting PIMS Comprehensive QA Verification Suite (MongoDB)..." });

  emailService.setProvider(new MockEmailProvider());
  emailService.clearSentEmails();

  await connectDb();
  await cleanTenant(TENANT_A_SLUG);
  await cleanTenant(TENANT_B_SLUG);

  server = await new Promise((resolve) => {
    const s = app.listen(PORT, () => resolve(s));
  });

  let tokenAdminA, tokenPharmacistA, tokenAdminB;
  let medicineAId, batchAId, staffAId, alertAId, ticketAId;
  let medicineBId;

  try {
    // ══════════════════════════════════════════════════════════════════════════
    section("1. NEW PHARMACY REGISTRATION & ADMIN CREATION");
    // ══════════════════════════════════════════════════════════════════════════
    // 1. Request Registration OTP for Tenant A
    const otpResA = await req("POST", "/auth/send-registration-otp", {
      name: "Admin QA One",
      email: "admin_a@qapims.com",
      pharmacyId: TENANT_A_SLUG
    });
    assert(otpResA.status === 200, "POST /auth/send-registration-otp returns 200");
    const otpA = emailService.getLastSentEmail()?.metadata?.otp;
    assert(!!otpA, "Registration OTP email dispatched");

    // 2. Reject registration without OTP or bad OTP
    const badOtpReg = await req("POST", "/auth/register", {
      name: "Admin QA One",
      email: "admin_a@qapims.com",
      password: "Password123!",
      pharmacyId: TENANT_A_SLUG,
      otp: "000000"
    });
    assert(badOtpReg.status === 400, "Registration with invalid OTP rejected with 400");

    // 3. Register Tenant A with valid OTP
    const regA = await req("POST", "/auth/register", {
      name: "Admin QA One",
      email: "admin_a@qapims.com",
      password: "Password123!",
      pharmacyId: TENANT_A_SLUG,
      otp: otpA
    });
    assert(regA.status === 201, "New pharmacy registration returns 201");
    assert(regA.data.success === true, "Registration returns success: true");

    // DB Verification: Pharmacy & User documents created & linked in MongoDB
    const dbPharmA = await Pharmacy.findOne({ slug: TENANT_A_SLUG });
    assert(!!dbPharmA, "Pharmacy document created in MongoDB with slug");
    const dbUserA = await User.findOne({ email: "admin_a@qapims.com" });
    assert(!!dbUserA, "Admin user document created in MongoDB");
    assert(dbUserA.pharmacyId.toString() === dbPharmA._id.toString(), "Admin user correctly linked to Pharmacy ObjectId");
    assert(dbUserA.role === "Admin", "Registered pharmacy owner is assigned 'Admin' role");
    assert(dbUserA.password.startsWith("$2"), "Password stored securely as bcrypt hash");
    assert(await bcrypt.compare("Password123!", dbUserA.password), "Bcrypt verification matches password");

    // Attempting to register with an existing pharmacy identifier is rejected with 409
    await req("POST", "/auth/send-registration-otp", {
      name: "Duplicate Pharmacy Creator",
      email: "staff_two@qapims.com",
      pharmacyId: TENANT_A_SLUG
    });
    const dupSlug = await req("POST", "/auth/register", {
      name: "Duplicate Pharmacy Creator",
      email: "staff_two@qapims.com",
      password: "Password123!",
      pharmacyId: TENANT_A_SLUG,
      otp: "123456"
    });
    assert(dupSlug.status === 409, "Public registration with existing pharmacy identifier rejected with 409 (prevents unauthorized workspace joining)");

    // Duplicate email check
    const dupEmail = await req("POST", "/auth/register", {
      name: "Admin Dup Email",
      email: "admin_a@qapims.com",
      password: "Password123!",
      pharmacyId: "different-slug",
      otp: "123456"
    });
    assert(dupEmail.status === 409, "Duplicate email registration rejected with 409");

    // Register Tenant B
    await req("POST", "/auth/send-registration-otp", {
      name: "Admin QA Two",
      email: "admin_b@qapims.com",
      pharmacyId: TENANT_B_SLUG
    });
    const otpB = emailService.getLastSentEmail()?.metadata?.otp;

    const regB = await req("POST", "/auth/register", {
      name: "Admin QA Two",
      email: "admin_b@qapims.com",
      password: "Password123!",
      pharmacyId: TENANT_B_SLUG,
      otp: otpB
    });
    assert(regB.status === 201, "Tenant B registration returns 201");

    // ══════════════════════════════════════════════════════════════════════════
    section("2. LOGIN, SESSION, REFRESH & LOGOUT FLOW");
    // ══════════════════════════════════════════════════════════════════════════
    // Admin A Login
    const loginA = await req("POST", "/auth/login", {
      email: "admin_a@qapims.com",
      password: "Password123!"
    });
    assert(loginA.ok, "Admin A login returns 200");
    tokenAdminA = loginA.data.data?.accessToken;
    assert(typeof tokenAdminA === "string" && tokenAdminA.length > 20, "Login returns valid JWT accessToken");
    assert(loginA.data.data?.refreshToken === undefined, "refreshToken is NOT in JSON response data (strictly in httpOnly cookie)");
    assert(loginA.setCookie.includes("refreshToken="), "refreshToken set securely in httpOnly Set-Cookie header");
    assert(loginA.setCookie.toLowerCase().includes("httponly"), "Set-Cookie header contains HttpOnly attribute");

    // Admin B Login
    const loginB = await req("POST", "/auth/login", {
      email: "admin_b@qapims.com",
      password: "Password123!"
    });
    assert(loginB.ok, "Admin B login returns 200");
    tokenAdminB = loginB.data.data?.accessToken;

    // Invalid credentials
    const badLogin = await req("POST", "/auth/login", {
      email: "admin_a@qapims.com",
      password: "WrongPassword!"
    });
    assert(badLogin.status === 401, "Invalid password login rejected with 401");

    const nonExistentLogin = await req("POST", "/auth/login", {
      email: "nobody@qapims.com",
      password: "Password123!"
    });
    assert(nonExistentLogin.status === 401, "Nonexistent user login rejected with 401");

    // Token refresh via httpOnly cookie
    const cookieHeader = loginA.setCookie.split(";")[0];
    const refreshRes = await req("POST", "/auth/refresh", null, null, cookieHeader);
    assert(refreshRes.ok, "POST /auth/refresh with httpOnly cookie returns new accessToken");
    assert(typeof refreshRes.data.data?.accessToken === "string", "Refreshed token is valid string");

    // Logout
    const logoutRes = await req("POST", "/auth/logout", null, tokenAdminA);
    assert(logoutRes.ok, "POST /auth/logout returns 200");

    // Protected API without auth
    const noAuth = await req("GET", "/auth/profile", null, null);
    assert(noAuth.status === 401, "Protected route without auth returns 401");

    // Protected API with malformed auth
    const malformedAuth = await req("GET", "/auth/profile", null, "not-a-valid-jwt");
    assert(malformedAuth.status === 401, "Protected route with malformed JWT returns 401");

    // ══════════════════════════════════════════════════════════════════════════
    section("3. STAFF CREATION & LOGIN IDENTITY SYNCHRONIZATION");
    // ══════════════════════════════════════════════════════════════════════════
    const createStaffA = await req("POST", "/staff", {
      name: "Sarah Pharmacist",
      email: "sarah_pharmacist@qapims.com",
      position: "Pharmacist",
      department: "Dispensing",
      salary: 40000,
      joinDate: new Date().toISOString()
    }, tokenAdminA);
    assert(createStaffA.status === 201, "Admin A creates staff member -> 201");
    staffAId = createStaffA.data.data?.id || createStaffA.data.data?._id;

    // Verify staff has automatic login user account in MongoDB
    const staffUserInDb = await User.findOne({ email: "sarah_pharmacist@qapims.com" });
    assert(!!staffUserInDb, "Staff creation automatically created linked user login");
    assert(staffUserInDb.role === "Pharmacist", "Linked user has 'Pharmacist' role");

    // Log in as Pharmacist
    const loginPharmA = await req("POST", "/auth/login", {
      email: "sarah_pharmacist@qapims.com",
      password: "ChangeMe123!"
    });
    assert(loginPharmA.ok, "Staff Pharmacist can log in with initial credentials");
    tokenPharmacistA = loginPharmA.data.data?.accessToken;

    // Update staff details
    const updateStaffRes = await req("PUT", `/staff/${staffAId}`, {
      name: "Sarah Senior Pharmacist",
      email: "sarah_pharmacist@qapims.com",
      position: "Senior Pharmacist",
      department: "Dispensing",
      salary: 45000,
      status: "Active"
    }, tokenAdminA);
    assert(updateStaffRes.ok, "Admin updates staff record -> 200");
    const updatedStaffUser = await User.findOne({ email: "sarah_pharmacist@qapims.com" });
    assert(updatedStaffUser.name === "Sarah Senior Pharmacist", "Staff name update synced to users collection");

    // Add temporary staff and delete
    const tempStaffRes = await req("POST", "/staff", {
      name: "Temp Pharmacist",
      email: "temp_pharmacist@qapims.com",
      position: "Pharmacist",
      department: "Dispensing"
    }, tokenAdminA);
    const tempStaffId = tempStaffRes.data.data?.id || tempStaffRes.data.data?._id;
    assert(tempStaffRes.status === 201, "Admin creates temporary staff member -> 201");

    const deleteStaffRes = await req("DELETE", `/staff/${tempStaffId}`, null, tokenAdminA);
    assert(deleteStaffRes.ok, "Admin deletes temporary staff member -> 200");
    const deletedUserCheck = await User.findOne({ email: "temp_pharmacist@qapims.com" });
    assert(!deletedUserCheck, "Staff deletion revoked and removed linked user account from MongoDB");

    // ══════════════════════════════════════════════════════════════════════════
    section("4. ADMIN VS PHARMACIST ROLE-BASED ACCESS CONTROL (RBAC)");
    // ══════════════════════════════════════════════════════════════════════════
    // Pharmacist tries admin-only actions -> 403 Forbidden
    const pharmAddStaff = await req("POST", "/staff", {
      name: "Hacker Staff",
      email: "hacker@qapims.com",
      position: "Admin"
    }, tokenPharmacistA);
    assert(pharmAddStaff.status === 403, "Pharmacist cannot create staff -> 403 Forbidden");

    const pharmDeleteStaff = await req("DELETE", `/staff/${staffAId}`, null, tokenPharmacistA);
    assert(pharmDeleteStaff.status === 403, "Pharmacist cannot delete staff -> 403 Forbidden");

    const pharmCreateMed = await req("POST", "/inventory/medicines", {
      name: "Restricted Med",
      sku: "REST-001",
      buyingPrice: 10,
      sellingPrice: 15
    }, tokenPharmacistA);
    assert(pharmCreateMed.status === 403, "Pharmacist cannot create catalog medicine -> 403 Forbidden");

    const pharmFinancials = await req("GET", "/financials", null, tokenPharmacistA);
    assert(pharmFinancials.status === 403, "Pharmacist cannot view financials -> 403 Forbidden");

    const pharmExport = await req("GET", "/export/transactions", null, tokenPharmacistA);
    assert(pharmExport.status === 403, "Pharmacist cannot export transactions -> 403 Forbidden");

    // ══════════════════════════════════════════════════════════════════════════
    section("5. MEDICINE + INVENTORY BATCH CRUD & CONSTRAINTS");
    // ══════════════════════════════════════════════════════════════════════════
    // Create Medicine in Tenant A
    const medARes = await req("POST", "/inventory/medicines", {
      name: "Amoxicillin 500mg",
      sku: "AMO-500-QA",
      brand: "MoxClav",
      category: "Antibiotic",
      buyingPrice: 12.50,
      sellingPrice: 20.00,
      leadTimeDays: 4
    }, tokenAdminA);
    assert(medARes.status === 201, "Admin A creates Medicine -> 201");
    medicineAId = medARes.data.data?.id || medARes.data.data?._id;

    // Update Medicine
    const updateMedRes = await req("PATCH", `/inventory/medicines/${medicineAId}`, {
      sellingPrice: 22.00,
      description: "Updated Antibiotic capsule"
    }, tokenAdminA);
    assert(updateMedRes.ok, "Admin A updates Medicine price & description -> 200");
    assert(Number(updateMedRes.data.data?.sellingPrice) === 22.00, "Updated price reflected");

    // Create Inventory Batch
    const futureExpiry = new Date();
    futureExpiry.setFullYear(futureExpiry.getFullYear() + 1);

    const batchARes = await req("POST", "/inventory", {
      medicine: medicineAId,
      batchNumber: "BATCH-AMO-001",
      currentStock: 30,
      reorderLevel: 10,
      expiryDate: futureExpiry.toISOString()
    }, tokenAdminA);
    assert(batchARes.status === 201, "Admin A creates inventory batch -> 201");
    batchAId = batchARes.data.data?.id || batchARes.data.data?._id;

    // Negative stock validation
    const negStock = await req("POST", "/inventory", {
      medicine: medicineAId,
      batchNumber: "BATCH-NEG-001",
      currentStock: -10,
      reorderLevel: 5,
      expiryDate: futureExpiry.toISOString()
    }, tokenAdminA);
    assert(negStock.status === 400, "Creating batch with negative stock rejected -> 400");

    // Search Inventory
    const searchRes = await req("GET", "/inventory?search=Amoxicillin", null, tokenAdminA);
    assert(searchRes.ok && searchRes.data.data?.length >= 1, "Inventory search returns matched medicine");

    // Deleting medicine with active batches -> 400
    const deleteMedBlocked = await req("DELETE", `/inventory/medicines/${medicineAId}`, null, tokenAdminA);
    assert(deleteMedBlocked.status === 400, "Deleting medicine with existing inventory batches blocked -> 400");

    // Create temporary medicine + batch, delete batch, then delete medicine -> 200
    const tempMedRes = await req("POST", "/inventory/medicines", {
      name: "Temporary Med To Delete",
      sku: "TEMP-DEL-001",
      buyingPrice: 5,
      sellingPrice: 10
    }, tokenAdminA);
    const tempMedId = tempMedRes.data.data?.id || tempMedRes.data.data?._id;
    assert(tempMedRes.status === 201, "Admin creates temporary medicine -> 201");

    const tempBatchRes = await req("POST", "/inventory", {
      medicine: tempMedId,
      batchNumber: "BATCH-TEMP-DEL-01",
      currentStock: 10,
      reorderLevel: 2,
      expiryDate: futureExpiry.toISOString()
    }, tokenAdminA);
    const tempBatchId = tempBatchRes.data.data?.id || tempBatchRes.data.data?._id;
    assert(tempBatchRes.status === 201, "Admin creates temporary batch -> 201");

    const deleteBatchRes = await req("DELETE", `/inventory/${tempBatchId}`, null, tokenAdminA);
    assert(deleteBatchRes.ok, "Admin deletes temporary batch -> 200");
    const checkBatchGone = await Inventory.findById(tempBatchId);
    assert(!checkBatchGone, "Batch removed from MongoDB");

    const deleteMedSuccess = await req("DELETE", `/inventory/medicines/${tempMedId}`, null, tokenAdminA);
    assert(deleteMedSuccess.ok, "Admin deletes unreferenced medicine -> 200");
    const checkMedGone = await Medicine.findById(tempMedId);
    assert(!checkMedGone, "Medicine removed from MongoDB");


    // ══════════════════════════════════════════════════════════════════════════
    section("6. SELLING FLOW, OVERSELLING, EXPIRY BLOCK & ATOMIC CONCURRENCY");
    // ══════════════════════════════════════════════════════════════════════════
    // Valid Sale
    const sellRes = await req("POST", "/inventory/sell", {
      inventoryId: batchAId,
      quantity: 5,
      employeeId: staffAId,
      note: "Standard prescription sale"
    }, tokenPharmacistA);
    assert(sellRes.status === 201, "Pharmacist sells 5 units -> 201");
    assert(sellRes.data.data?.remainingStock === 25, "Remaining stock correctly decremented to 25");

    // Verify transaction record and staff sales updated in MongoDB
    const txDoc = await Transaction.findOne({ inventoryId: batchAId, type: "OUT" });
    assert(!!txDoc, "Transaction recorded in MongoDB with type 'OUT'");
    assert(Number(txDoc.unitSellPrice) === 22.00, "Transaction records accurate unit sell price");

    const staffDoc = await Staff.findById(staffAId);
    assert(Number(staffDoc.totalSales) > 0, "Staff employee totalSales updated after sale");

    // Oversell rejection
    const oversellRes = await req("POST", "/inventory/sell", {
      inventoryId: batchAId,
      quantity: 500,
      employeeId: staffAId
    }, tokenPharmacistA);
    assert(oversellRes.status === 400, "Overselling quantity exceeding stock rejected -> 400");

    // Expired stock sell rejection
    const pastExpiry = new Date();
    pastExpiry.setMonth(pastExpiry.getMonth() - 2);
    const expiredBatchRes = await req("POST", "/inventory", {
      medicine: medicineAId,
      batchNumber: "BATCH-EXPIRED-99",
      currentStock: 15,
      reorderLevel: 5,
      expiryDate: pastExpiry.toISOString()
    }, tokenAdminA);
    const expiredBatchId = expiredBatchRes.data.data?.id || expiredBatchRes.data.data?._id;

    const sellExpiredRes = await req("POST", "/inventory/sell", {
      inventoryId: expiredBatchId,
      quantity: 1,
      employeeId: staffAId
    }, tokenPharmacistA);
    assert(sellExpiredRes.status === 400, "Selling expired medicine batch rejected -> 400");

    // Concurrency Test: 15 simultaneous checkout requests on 10 units
    const concBatchRes = await req("POST", "/inventory", {
      medicine: medicineAId,
      batchNumber: "BATCH-CONC-LOCK",
      currentStock: 10,
      reorderLevel: 2,
      expiryDate: futureExpiry.toISOString()
    }, tokenAdminA);
    const concBatchId = concBatchRes.data.data?.id || concBatchRes.data.data?._id;

    const concOrders = await Promise.all(
      Array.from({ length: 15 }, () =>
        req("POST", "/inventory/sell", {
          inventoryId: concBatchId,
          quantity: 1,
          employeeId: staffAId,
          note: "Atomic lock test"
        }, tokenPharmacistA)
      )
    );
    const successes = concOrders.filter((r) => r.ok).length;
    const failuresCount = concOrders.filter((r) => !r.ok).length;
    assert(successes === 10, `Atomic concurrency: exactly 10 requests succeed (got ${successes})`);
    assert(failuresCount === 5, `Atomic concurrency: exactly 5 requests fail (got ${failuresCount})`);

    // Zero and negative quantity selling rejection
    const zeroSell = await req("POST", "/inventory/sell", {
      inventoryId: batchAId,
      quantity: 0,
      employeeId: staffAId
    }, tokenPharmacistA);
    assert(zeroSell.status === 400, "Selling zero quantity rejected -> 400");

    const negSell = await req("POST", "/inventory/sell", {
      inventoryId: batchAId,
      quantity: -5,
      employeeId: staffAId
    }, tokenPharmacistA);
    assert(negSell.status === 400, "Selling negative quantity rejected -> 400");

    // Restocking / Updating batch stock
    const restockRes = await req("PATCH", `/inventory/${batchAId}`, {
      currentStock: 50
    }, tokenAdminA);
    assert(restockRes.ok, "Restocking / updating inventory batch stock -> 200");
    const restockedBatch = await Inventory.findById(batchAId);
    assert(restockedBatch.currentStock === 50, "Restocked stock count persisted in MongoDB");


    // ══════════════════════════════════════════════════════════════════════════
    section("7. MULTI-TENANT ISOLATION (Pharmacy A vs Pharmacy B)");
    // ══════════════════════════════════════════════════════════════════════════
    // Tenant B creates its own medicine
    const medBRes = await req("POST", "/inventory/medicines", {
      name: "Tenant B Ibuprofen",
      sku: "IBU-B-001",
      buyingPrice: 5.0,
      sellingPrice: 9.0
    }, tokenAdminB);
    medicineBId = medBRes.data.data?.id || medBRes.data.data?._id;

    // Tenant B cannot see Tenant A's medicine in catalog list
    const tenantBMeds = await req("GET", "/inventory/medicines", null, tokenAdminB);
    assert(!tenantBMeds.data.data?.some((m) => (m.id || m._id)?.toString() === medicineAId?.toString()), "Tenant B catalog DOES NOT contain Tenant A medicine");

    // Tenant B cannot get, update, or delete Tenant A's medicine by ID
    const crossGetMed = await req("GET", `/inventory/medicines/${medicineAId}`, null, tokenAdminB);
    assert(crossGetMed.status === 404, "Tenant B GET Tenant A medicine by ID -> 404 Not Found");

    const crossPatchMed = await req("PATCH", `/inventory/medicines/${medicineAId}`, { name: "Hacked Name" }, tokenAdminB);
    assert(crossPatchMed.status === 404, "Tenant B PATCH Tenant A medicine -> 404 Not Found");

    const crossDeleteMed = await req("DELETE", `/inventory/medicines/${medicineAId}`, null, tokenAdminB);
    assert(crossDeleteMed.status === 404, "Tenant B DELETE Tenant A medicine -> 404 Not Found");

    // Tenant B cannot see, update, delete or sell Tenant A's inventory batch
    const tenantBInventory = await req("GET", "/inventory", null, tokenAdminB);
    assert(!tenantBInventory.data.data?.some((b) => (b.id || b._id)?.toString() === batchAId?.toString()), "Tenant B inventory DOES NOT list Tenant A batches");

    const crossPatchBatch = await req("PATCH", `/inventory/${batchAId}`, { reorderLevel: 99 }, tokenAdminB);
    assert(crossPatchBatch.status === 404, "Tenant B PATCH Tenant A inventory batch -> 404 Not Found");

    const crossSellBatch = await req("POST", "/inventory/sell", { inventoryId: batchAId, quantity: 1 }, tokenAdminB);
    assert(crossSellBatch.status === 404 || crossSellBatch.status === 400, "Tenant B sell Tenant A stock -> rejected (404/400)");

    // Tenant B cannot view Tenant A's staff
    const tenantBStaff = await req("GET", "/staff", null, tokenAdminB);
    assert(!tenantBStaff.data.data?.some((s) => (s.id || s._id)?.toString() === staffAId?.toString()), "Tenant B DOES NOT list Tenant A staff");

    // Cross-tenant employeeId integrity test: Tenant B staff cannot be used for Tenant A sale
    const createStaffB = await req("POST", "/staff", {
      name: "Tenant B Pharmacist",
      email: "pharmacist_b@qapims.com",
      position: "Pharmacist",
      department: "Dispensing"
    }, tokenAdminB);
    const staffBId = createStaffB.data.data?.id || createStaffB.data.data?._id;

    const crossStaffSale = await req("POST", "/inventory/sell", {
      inventoryId: batchAId,
      quantity: 1,
      employeeId: staffBId
    }, tokenAdminA);
    assert(crossStaffSale.status === 400, "Selling under Tenant A with Tenant B employeeId rejected with 400");

    // Manual transaction consistency test: OUT decrements stock, IN increments stock
    const txOutRes = await req("POST", "/inventory/transactions", {
      medicine: medicineAId,
      inventoryId: batchAId,
      type: "OUT",
      quantity: 5
    }, tokenAdminA);
    assert(txOutRes.status === 201, "Manual transaction OUT created -> 201");
    const batchAfterTxOut = await Inventory.findById(batchAId);
    assert(batchAfterTxOut.currentStock === 45, "Manual transaction OUT decrements batch stock to 45");

    const txInRes = await req("POST", "/inventory/transactions", {
      medicine: medicineAId,
      inventoryId: batchAId,
      type: "IN",
      quantity: 5
    }, tokenAdminA);
    assert(txInRes.status === 201, "Manual transaction IN created -> 201");
    const batchAfterTxIn = await Inventory.findById(batchAId);
    assert(batchAfterTxIn.currentStock === 50, "Manual transaction IN increments batch stock back to 50");

    // ══════════════════════════════════════════════════════════════════════════
    section("8. ALERTS & AUTOMATED DEDUPLICATION");
    // ══════════════════════════════════════════════════════════════════════════
    const alertBatchRes = await req("POST", "/inventory", {
      medicine: medicineAId,
      batchNumber: "BATCH-ALERT-DEDUP",
      currentStock: 1,
      reorderLevel: 5,
      expiryDate: futureExpiry.toISOString()
    }, tokenAdminA);
    const alertBatchId = alertBatchRes.data.data?.id || alertBatchRes.data.data?._id;

    // Run alert check twice on low-stock batch
    await checkAlertsForBatch(alertBatchId);
    await checkAlertsForBatch(alertBatchId); // Second execution to test deduplication

    const alertsA = await req("GET", "/alerts?limit=100", null, tokenAdminA);
    assert(alertsA.ok, "GET /alerts returns 200");
    const lowStockAlerts = alertsA.data.data?.filter((a) => (a.inventory?.id || a.inventory?._id)?.toString() === alertBatchId?.toString() && a.type === "LOW_STOCK" && !a.isResolved);
    assert(lowStockAlerts?.length === 1, "Alert job generated exactly 1 active alert (deduplicated against second run)");

    alertAId = lowStockAlerts?.[0]?.id || alertsA.data.data?.[0]?.id;
    const closeAlertRes = await req("PUT", `/alerts/${alertAId}/close`, null, tokenAdminA);
    assert(closeAlertRes.ok, "PUT /alerts/:id/close marks alert as resolved");
    assert(closeAlertRes.data.data?.isResolved === true, "Alert isResolved is true");

    // Tenant B cannot see Tenant A's alerts
    const alertsB = await req("GET", "/alerts?limit=100", null, tokenAdminB);
    assert(!alertsB.data.data?.some((a) => (a.id || a._id)?.toString() === alertAId?.toString()), "Tenant B DOES NOT see Tenant A alerts");

    // ══════════════════════════════════════════════════════════════════════════
    section("9. DASHBOARD STATS, FINANCIALS & EXPORTS");
    // ══════════════════════════════════════════════════════════════════════════
    const dashA = await req("GET", "/dashboard/stats", null, tokenAdminA);
    assert(dashA.ok, "GET /dashboard/stats returns 200");
    assert(typeof dashA.data.data?.expiredCount === "number", "Dashboard includes expiredCount");
    assert(typeof dashA.data.data?.lowStockCount === "number", "Dashboard includes lowStockCount");
    assert(typeof dashA.data.data?.profitThisMonth === "number", "Dashboard includes profitThisMonth");

    const finA = await req("GET", "/financials", null, tokenAdminA);
    assert(finA.ok, "GET /financials returns 200");
    assert(Number(finA.data.data?.totalRevenue) > 0, "Financials totalRevenue reflects sales made");

    // CSV Exports
    const exportStock = await req("GET", "/export/stock", null, tokenAdminA);
    assert(exportStock.ok, "GET /export/stock returns 200");
    assert(exportStock.headers.get("content-type")?.includes("text/csv"), "Stock export has text/csv header");
    assert(typeof exportStock.data === "string" && exportStock.data.includes("Amoxicillin"), "Stock CSV contains Tenant A medicine");
    assert(!exportStock.data.includes("Tenant B Ibuprofen"), "Stock CSV DOES NOT contain Tenant B medicine");

    const exportTx = await req("GET", "/export/transactions", null, tokenAdminA);
    assert(exportTx.ok, "GET /export/transactions returns 200");
    assert(exportTx.headers.get("content-type")?.includes("text/csv"), "Transactions export has text/csv header");

    // ══════════════════════════════════════════════════════════════════════════
    section("10. TIME-SERIES PREDICTIONS & PERIOD SCALING");
    // ══════════════════════════════════════════════════════════════════════════
    // Run prediction for 7 days
    const pred7 = await req("POST", "/predictions", { medicineId: medicineAId, periods: 7 }, tokenAdminA);
    assert(pred7.ok, "POST /predictions (7 days) returns 200");
    const d7 = Number(pred7.data.data?.predictedDemand);
    assert(d7 > 0, "7-day predictedDemand is positive number");
    assert(pred7.data.data?.recommendedStock === Math.ceil(d7 * 1.2), "recommendedStock = ceil(predictedDemand * 1.2)");

    // Run prediction for 30 days
    const pred30 = await req("POST", "/predictions", { medicineId: medicineAId, periods: 30 }, tokenAdminA);
    assert(pred30.ok, "POST /predictions (30 days) returns 200");
    const d30 = Number(pred30.data.data?.predictedDemand);
    assert(d30 > d7, "30-day forecast demand is greater than 7-day forecast demand");

    // Run prediction for 14 days
    const pred14 = await req("POST", "/predictions", { medicineId: medicineAId, periods: 14 }, tokenAdminA);
    assert(pred14.ok, "POST /predictions (14 days) returns 200");
    const d14 = Number(pred14.data.data?.predictedDemand);
    assert(d14 > d7 && d14 < d30, "14-day forecast demand is between 7-day and 30-day");

    // Run prediction for 60 days
    const pred60 = await req("POST", "/predictions", { medicineId: medicineAId, periods: 60 }, tokenAdminA);
    assert(pred60.ok, "POST /predictions (60 days) returns 200");
    const d60 = Number(pred60.data.data?.predictedDemand);
    assert(d60 > d30, "60-day forecast demand scales proportionally");

    // Run prediction for 90 days
    const pred90 = await req("POST", "/predictions", { medicineId: medicineAId, periods: 90 }, tokenAdminA);
    assert(pred90.ok, "POST /predictions (90 days) returns 200");
    const d90 = Number(pred90.data.data?.predictedDemand);
    assert(d90 > d60, "90-day forecast demand scales proportionally");

    // Prediction history
    const predHist = await req("GET", "/predictions/history", null, tokenAdminA);
    assert(predHist.ok && predHist.data.data?.length >= 1, "Predictions history recorded and retrievable");

    // ══════════════════════════════════════════════════════════════════════════
    section("11. USER SETTINGS, PREFERENCES & SUPPORT TICKETS");
    // ══════════════════════════════════════════════════════════════════════════
    // Reject profile name change without OTP
    const rejectProfWithoutOtp = await req("PUT", "/auth/profile", { name: "Admin A Renamed" }, tokenAdminA);
    assert(rejectProfWithoutOtp.status === 400, "PUT /auth/profile name change without OTP rejected with 400");

    // Request settings OTP for CHANGE_NAME
    await req("POST", "/auth/send-settings-otp", { action: "CHANGE_NAME" }, tokenAdminA);
    const nameOtp = emailService.getLastSentEmail()?.metadata?.otp;

    // Update profile with OTP
    const updateProf = await req("PUT", "/auth/profile", { name: "Admin A Renamed", otp: nameOtp }, tokenAdminA);
    assert(updateProf.ok, "PUT /auth/profile returns 200");
    assert(updateProf.data.data?.name === "Admin A Renamed", "Profile name updated in DB");

    // Reject password change without OTP
    const rejectPassWithoutOtp = await req("PUT", "/auth/profile", {
      currentPassword: "Password123!",
      newPassword: "NewPassword456!"
    }, tokenAdminA);
    assert(rejectPassWithoutOtp.status === 400, "PUT /auth/profile password change without OTP rejected with 400");

    // Request settings OTP for CHANGE_PASSWORD
    await req("POST", "/auth/send-settings-otp", { action: "CHANGE_PASSWORD" }, tokenAdminA);
    const passOtp = emailService.getLastSentEmail()?.metadata?.otp;

    // Change Password with OTP
    const updatePass = await req("PUT", "/auth/profile", {
      name: "Admin A Renamed",
      currentPassword: "Password123!",
      newPassword: "NewPassword456!",
      otp: passOtp
    }, tokenAdminA);
    assert(updatePass.ok, "Password updated successfully with valid current password and OTP");

    // Login with new password
    const loginWithNewPass = await req("POST", "/auth/login", {
      email: "admin_a@qapims.com",
      password: "NewPassword456!"
    });
    assert(loginWithNewPass.ok, "Login with new password succeeds");
    tokenAdminA = loginWithNewPass.data.data?.accessToken; // Update token

    // Save & retrieve notification preferences
    const savePrefs = await req("PUT", "/auth/preferences", {
      emailNotifications: false,
      inventoryAlerts: true,
      weeklyReports: true
    }, tokenAdminA);
    assert(savePrefs.ok, "PUT /auth/preferences saves user settings");

    const getPrefs = await req("GET", "/auth/preferences", null, tokenAdminA);
    assert(getPrefs.data.data?.emailNotifications === false, "Persisted emailNotifications is false");
    assert(getPrefs.data.data?.weeklyReports === true, "Persisted weeklyReports is true");

    // Create & manage Support Tickets
    const createTicket = await req("POST", "/support", {
      subject: "Assistance with batch scanner",
      message: "Scanner requires reconfiguration for batch barcode labels."
    }, tokenAdminA);
    assert(createTicket.status === 201, "POST /support creates ticket -> 201");
    ticketAId = createTicket.data.data?.id || createTicket.data.data?._id;

    const listTickets = await req("GET", "/support", null, tokenAdminA);
    assert(listTickets.data.data?.some((t) => (t.id || t._id)?.toString() === ticketAId?.toString()), "Created ticket visible in support list");

    const closeTicket = await req("PATCH", `/support/${ticketAId}/status`, { status: "closed" }, tokenAdminA);
    assert(closeTicket.ok && closeTicket.data.data?.status === "closed", "PATCH /support/:id/status closes ticket");

    // ══════════════════════════════════════════════════════════════════════════
    section("12. MALFORMED REQUESTS & ERROR HANDLING");
    // ══════════════════════════════════════════════════════════════════════════
    const malformedIdRes = await req("GET", "/inventory/000000000000000000000000", null, tokenAdminA);
    assert(malformedIdRes.status === 404, "Non-existent resource returns 404 Not Found");

    const missingFieldsRes = await req("POST", "/inventory", {}, tokenAdminA);
    assert(missingFieldsRes.status === 400, "Missing required request body fields returns 400");

    // ══════════════════════════════════════════════════════════════════════════
    section("13. SEEDED DATABASE & DEMO ACCOUNTS");
    // ══════════════════════════════════════════════════════════════════════════
    // Demo Admin
    const demoAdminLogin = await req("POST", "/auth/login", {
      email: "admin@hospital.com",
      password: "ChangeMe123!"
    });
    assert(demoAdminLogin.ok, "Seeded demo Admin (admin@hospital.com) logs in successfully");

    // Demo Pharmacist
    const demoPharmLogin = await req("POST", "/auth/login", {
      email: "jane@hospital.com",
      password: "ChangeMe123!"
    });
    assert(demoPharmLogin.ok, "Seeded demo Pharmacist (jane@hospital.com) logs in successfully");

    // Demo Tenant 2 Admin
    const demoAdmin2Login = await req("POST", "/auth/login", {
      email: "admin2@hospital.com",
      password: "ChangeMe123!"
    });
    assert(demoAdmin2Login.ok, "Seeded demo Tenant 2 Admin (admin2@hospital.com) logs in successfully");

  } catch (err) {
    logger.error({ message: `Unexpected error in test suite: ${err.message}`, stack: err.stack });
    failed++;
  } finally {
    logger.info({ message: `\n════════════════════════════════════` });
    logger.info({ message: `  QA Verification Suite: ${passed} passed, ${failed} failed` });
    if (failures.length > 0) {
      logger.error({ message: `  Failed Tests:\n    - ${failures.join("\n    - ")}` });
    }
    logger.info({ message: `════════════════════════════════════\n` });

    if (failed > 0) process.exitCode = 1;

    try {
      await cleanTenant(TENANT_A_SLUG);
      await cleanTenant(TENANT_B_SLUG);
    } catch { /* ignore */ }

    server.close(async () => {
      await disconnectDb();
      logger.info({ message: "Test server shut down cleanly." });
    });
  }
}

runQaVerificationSuite();
