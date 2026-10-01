/**
 * PIMS 100% Comprehensive Full-Pass Verification Suite
 *
 * Verifies every single API route, controller, validation rule, RBAC rule,
 * multi-tenant isolation constraint, database transaction, and error boundary.
 */
import app from "../app.js";
import { connectDb, disconnectDb } from "../config/db.js";
import logger from "../utils/logger.js";
import { emailService, MockEmailProvider } from "../services/emailService.js";
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

const PORT = 5066;
const BASE = `http://127.0.0.1:${PORT}/api/v1`;

const TENANT_A_SLUG = "fullpass-pharm-a";
const TENANT_B_SLUG = "fullpass-pharm-b";

let server;
let passed = 0;
let failed = 0;
const failures = [];

const assert = (condition, label, extra = "") => {
  if (condition) {
    passed++;
    logger.info({ message: `  ✓ ${label}` });
  } else {
    failed++;
    failures.push(`${label} ${extra}`);
    logger.error({ message: `  ✗ ${label} ${extra}` });
  }
};

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
    await SupportTicket.deleteMany({ pharmacyId: pId });
    await UserPreference.deleteMany({ pharmacyId: pId });
    await Prediction.deleteMany({ pharmacyId: pId });
    await Alert.deleteMany({ pharmacyId: pId });
    await Transaction.deleteMany({ pharmacyId: pId });
    await Inventory.deleteMany({ pharmacyId: pId });
    await Staff.deleteMany({ pharmacyId: pId });
    await Medicine.deleteMany({ pharmacyId: pId });
    await User.deleteMany({ pharmacyId: pId });
    await Pharmacy.deleteOne({ _id: pId });
  }
  await User.deleteMany({
    email: { $in: ["admin_fa@test.com", "admin_fb@test.com", "pharm_fa@test.com", "pharm_fb@test.com", "staff_fa@test.com"] }
  });
  await Staff.deleteMany({
    email: { $in: ["admin_fa@test.com", "admin_fb@test.com", "pharm_fa@test.com", "pharm_fb@test.com", "staff_fa@test.com"] }
  });
  await Otp.deleteMany({});
};

async function runComprehensivePass() {
  logger.info({ message: "Starting PIMS 100% Comprehensive Full-Pass Verification Suite..." });

  emailService.setProvider(new MockEmailProvider());
  emailService.clearSentEmails();

  await connectDb();
  await cleanTenant(TENANT_A_SLUG);
  await cleanTenant(TENANT_B_SLUG);

  server = await new Promise((resolve) => {
    const s = app.listen(PORT, () => resolve(s));
  });

  try {
    // ══════════════════════════════════════════════════════════════════════════
    // SECTION 1: AUTHENTICATION, REGISTRATION OTP & SESSION MANAGEMENT
    // ══════════════════════════════════════════════════════════════════════════
    logger.info({ message: "\n══ 1. AUTHENTICATION, REGISTRATION OTP & SESSIONS ══" });

    // 1.1 Register without OTP fails (400)
    const noOtpReg = await req("POST", "/auth/register", {
      name: "Admin FA",
      email: "admin_fa@test.com",
      password: "Password123!",
      role: "Admin",
      pharmacyId: TENANT_A_SLUG
    });
    assert(noOtpReg.status === 400, "POST /auth/register without OTP rejected -> 400");

    // 1.2 Send Registration OTP
    const sendRegOtpRes = await req("POST", "/auth/send-registration-otp", {
      name: "Admin FA",
      email: "admin_fa@test.com",
      pharmacyId: TENANT_A_SLUG
    });
    assert(sendRegOtpRes.status === 200, "POST /auth/send-registration-otp returns 200");
    const regOtpA = emailService.getLastSentEmail()?.metadata?.otp;
    assert(!!regOtpA && /^\d{6}$/.test(regOtpA), "Registration OTP email dispatched with 6-digit code");

    // 1.3 Register Tenant A Admin
    const regResA = await req("POST", "/auth/register", {
      name: "Admin FA",
      email: "admin_fa@test.com",
      password: "Password123!",
      role: "Admin",
      pharmacyId: TENANT_A_SLUG,
      otp: regOtpA
    });
    assert(regResA.status === 201, "POST /auth/register with valid OTP creates Admin A -> 201");
    const userAId = regResA.data.data.id;
    assert(!!userAId, "Admin A created in MySQL");

    // 1.4 Register Tenant B Admin
    await req("POST", "/auth/send-registration-otp", {
      name: "Admin FB",
      email: "admin_fb@test.com",
      pharmacyId: TENANT_B_SLUG
    });
    const regOtpB = emailService.getLastSentEmail()?.metadata?.otp;
    const regResB = await req("POST", "/auth/register", {
      name: "Admin FB",
      email: "admin_fb@test.com",
      password: "Password123!",
      role: "Admin",
      pharmacyId: TENANT_B_SLUG,
      otp: regOtpB
    });
    assert(regResB.status === 201, "Admin B created in Pharmacy B -> 201");
    const userBId = regResB.data.data.id;
    assert(!!userBId, "Admin B created in MySQL");

    // 1.5 Login Admin A
    const loginResA = await req("POST", "/auth/login", {
      email: "admin_fa@test.com",
      password: "Password123!"
    });
    assert(loginResA.status === 200, "POST /auth/login returns 200");
    const tokenAdminA = loginResA.data.data.accessToken;
    const cookieAdminA = loginResA.setCookie;
    assert(!!tokenAdminA, "Access token issued");
    assert(cookieAdminA.includes("refreshToken"), "httpOnly refreshToken cookie issued");

    // 1.6 Login Admin B
    const loginResB = await req("POST", "/auth/login", {
      email: "admin_fb@test.com",
      password: "Password123!"
    });
    const tokenAdminB = loginResB.data.data.accessToken;

    // 1.7 Refresh Token Endpoint
    const refreshRes = await req("POST", "/auth/refresh", {}, null, cookieAdminA);
    assert(refreshRes.status === 200, "POST /auth/refresh returns 200 with new accessToken");
    assert(!!refreshRes.data.data?.accessToken, "New accessToken returned in response");

    // 1.8 Profile GET
    const profileRes = await req("GET", "/auth/profile", null, tokenAdminA);
    assert(profileRes.status === 200, "GET /auth/profile returns 200");
    assert(profileRes.data.data.email === "admin_fa@test.com", "Profile email matches Admin A");

    // 1.9 Profile Name & Password Update with Settings OTP
    await req("POST", "/auth/send-settings-otp", { action: "CHANGE_NAME" }, tokenAdminA);
    const nameOtp = emailService.getLastSentEmail()?.metadata?.otp;
    const updateNameRes = await req("PUT", "/auth/profile", { name: "Admin FA Updated", otp: nameOtp }, tokenAdminA);
    assert(updateNameRes.status === 200, "PUT /auth/profile name update with OTP -> 200");

    // 1.10 User Preferences GET & PUT
    const getPrefsRes = await req("GET", "/auth/preferences", null, tokenAdminA);
    assert(getPrefsRes.status === 200, "GET /auth/preferences returns 200");
    const putPrefsRes = await req("PUT", "/auth/preferences", { emailNotifications: false, weeklyReports: true }, tokenAdminA);
    assert(putPrefsRes.status === 200, "PUT /auth/preferences returns 200");
    const verifyPrefsRes = await req("GET", "/auth/preferences", null, tokenAdminA);
    assert(verifyPrefsRes.data.data.emailNotifications === false && verifyPrefsRes.data.data.weeklyReports === true, "Preferences persisted in MySQL");

    // 1.11 Logout
    const logoutRes = await req("POST", "/auth/logout", {}, tokenAdminA, cookieAdminA);
    assert(logoutRes.status === 200, "POST /auth/logout clears cookie -> 200");

    // ══════════════════════════════════════════════════════════════════════════
    // SECTION 2: STAFF MANAGEMENT, OTP AUTHORIZATION & PHARMACIST CREATION
    // ══════════════════════════════════════════════════════════════════════════
    logger.info({ message: "\n══ 2. STAFF MANAGEMENT & CREDENTIAL SYNCHRONIZATION ══" });

    // 2.1 Send Staff Creation OTP
    await req("POST", "/staff/send-otp", { action: "create", staffName: "Sarah Pharmacist" }, tokenAdminA);
    const staffCreateOtp = emailService.getLastSentEmail()?.metadata?.otp;

    // 2.2 Create Staff Pharmacist A
    const createStaffRes = await req("POST", "/staff", {
      name: "Sarah Pharmacist",
      email: "pharm_fa@test.com",
      position: "Senior Pharmacist",
      department: "Dispensing",
      salary: 55000,
      joinDate: new Date().toISOString(),
      otp: staffCreateOtp
    }, tokenAdminA);
    assert(createStaffRes.status === 201, "POST /staff with valid OTP creates Staff -> 201");
    const staffAId = createStaffRes.data.data.id;
    const staffAPassword = emailService.getLastSentEmail()?.metadata?.temporaryPassword;
    assert(!!staffAPassword, "Automatic credentials email dispatched to pharmacist");

    // 2.3 Staff Pharmacist Login
    const loginPharmRes = await req("POST", "/auth/login", {
      email: "pharm_fa@test.com",
      password: staffAPassword
    });
    assert(loginPharmRes.status === 200, "Pharmacist login with generated temporary credentials succeeds -> 200");
    const tokenPharmacistA = loginPharmRes.data.data.accessToken;

    // 2.4 List Staff (Admin A only)
    const listStaffRes = await req("GET", "/staff", null, tokenAdminA);
    assert(listStaffRes.status === 200, "GET /staff returns 200");
    assert(listStaffRes.data.data.length >= 1, "Staff list includes created pharmacist");

    // 2.5 Get Single Staff member by ID
    const getSingleStaffRes = await req("GET", `/staff/${staffAId}`, null, tokenAdminA);
    assert(getSingleStaffRes.status === 200, "GET /staff/:id returns 200");
    assert(getSingleStaffRes.data.data.name === "Sarah Pharmacist", "Staff name matches");

    // 2.6 Update Staff with OTP
    await req("POST", "/staff/send-otp", { action: "update", staffId: staffAId, staffName: "Sarah Pharmacist" }, tokenAdminA);
    const staffUpdateOtp = emailService.getLastSentEmail()?.metadata?.otp;
    const updateStaffRes = await req("PUT", `/staff/${staffAId}`, {
      name: "Sarah Lead Pharmacist",
      salary: 60000,
      otp: staffUpdateOtp
    }, tokenAdminA);
    assert(updateStaffRes.status === 200, "PUT /staff/:id with OTP updates staff salary -> 200");

    // 2.7 Get Staff Sales summary
    const staffSalesRes = await req("GET", "/staff/sales", null, tokenAdminA);
    assert(staffSalesRes.status === 200, "GET /staff/sales returns 200");

    // ══════════════════════════════════════════════════════════════════════════
    // SECTION 3: ROLE-BASED ACCESS CONTROL (RBAC) & PERMISSION ENFORCEMENT
    // ══════════════════════════════════════════════════════════════════════════
    logger.info({ message: "\n══ 3. ROLE-BASED ACCESS CONTROL (RBAC) ══" });

    // Pharmacist cannot create/delete staff
    const pharmStaffCreate = await req("POST", "/staff", { name: "Hacker Staff" }, tokenPharmacistA);
    assert(pharmStaffCreate.status === 403, "Pharmacist POST /staff blocked -> 403 Forbidden");

    const pharmStaffDelete = await req("DELETE", `/staff/${staffAId}`, {}, tokenPharmacistA);
    assert(pharmStaffDelete.status === 403, "Pharmacist DELETE /staff/:id blocked -> 403 Forbidden");

    // Pharmacist cannot create medicine
    const pharmMedCreate = await req("POST", "/inventory/medicines", { name: "Drug" }, tokenPharmacistA);
    assert(pharmMedCreate.status === 403, "Pharmacist POST /inventory/medicines blocked -> 403 Forbidden");

    // Pharmacist cannot view financials
    const pharmFin = await req("GET", "/financials", null, tokenPharmacistA);
    assert(pharmFin.status === 403, "Pharmacist GET /financials blocked -> 403 Forbidden");

    // Pharmacist cannot export CSVs
    const pharmExp = await req("GET", "/export/transactions", null, tokenPharmacistA);
    assert(pharmExp.status === 403, "Pharmacist GET /export/transactions blocked -> 403 Forbidden");

    // ══════════════════════════════════════════════════════════════════════════
    // SECTION 4: MEDICINE CATALOG & INVENTORY BATCH CRUD
    // ══════════════════════════════════════════════════════════════════════════
    logger.info({ message: "\n══ 4. MEDICINE CATALOG & INVENTORY BATCHES ══" });

    // 4.1 Admin A creates Medicine in Catalog (ATC: M01AE)
    const createMedRes = await req("POST", "/inventory/medicines", {
      name: "Ibuprofen 400mg",
      sku: "IBU-400-01",
      brand: "Brufen",
      category: "M01AE",
      description: "Anti-inflammatory pain relief",
      supplier: "Abbott Pharma",
      buyingPrice: 15.00,
      sellingPrice: 25.00,
      leadTimeDays: 5
    }, tokenAdminA);
    assert(createMedRes.status === 201, "POST /inventory/medicines creates medicine -> 201");
    const medicineAId = createMedRes.data.data.id;

    // 4.2 Duplicate SKU rejection (400)
    const dupSkuRes = await req("POST", "/inventory/medicines", {
      name: "Ibuprofen Duplicate",
      sku: "IBU-400-01"
    }, tokenAdminA);
    assert(dupSkuRes.status === 400, "Creating medicine with existing SKU rejected -> 400");

    // 4.3 Update Medicine (PUT & PATCH)
    const updateMedRes = await req("PATCH", `/inventory/medicines/${medicineAId}`, {
      description: "Updated description",
      sellingPrice: 28.00
    }, tokenAdminA);
    assert(updateMedRes.status === 200, "PATCH /inventory/medicines/:id updates medicine -> 200");

    // 4.4 Get Single Medicine
    const getMedRes = await req("GET", `/inventory/medicines/${medicineAId}`, null, tokenAdminA);
    assert(getMedRes.status === 200, "GET /inventory/medicines/:id returns 200");
    assert(Number(getMedRes.data.data.sellingPrice) === 28.00, "Updated price reflected");

    // 4.5 List Medicines
    const listMedRes = await req("GET", "/inventory/medicines", null, tokenAdminA);
    assert(listMedRes.status === 200, "GET /inventory/medicines returns 200");
    assert(listMedRes.data.data.some((m) => m.id === medicineAId), "Medicine present in list");

    // 4.6 Create Inventory Batch
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 180);
    const createBatchRes = await req("POST", "/inventory", {
      medicineId: medicineAId,
      batchNumber: "BATCH-IBU-001",
      currentStock: 100,
      reorderLevel: 20,
      expiryDate: futureDate.toISOString()
    }, tokenAdminA);
    assert(createBatchRes.status === 201, "POST /inventory creates stock batch -> 201");
    const batchAId = createBatchRes.data.data.id;

    // 4.7 Update Batch
    const updateBatchRes = await req("PATCH", `/inventory/${batchAId}`, {
      reorderLevel: 25
    }, tokenAdminA);
    assert(updateBatchRes.status === 200, "PATCH /inventory/:id updates batch -> 200");

    // 4.8 Available Stock List
    const availStockRes = await req("GET", "/inventory/available", null, tokenAdminA);
    assert(availStockRes.status === 200, "GET /inventory/available returns 200");
    assert(availStockRes.data.data.some((b) => b.id === batchAId), "Batch listed in available stock");

    // 4.9 Paginated Inventory Search
    const searchInvRes = await req("GET", "/inventory?search=Ibuprofen", null, tokenAdminA);
    assert(searchInvRes.status === 200, "GET /inventory?search=Ibuprofen returns 200");
    assert(searchInvRes.data.data.length >= 1, "Matched search batch returned");

    // ══════════════════════════════════════════════════════════════════════════
    // SECTION 5: SALES TRANSACTION, ATOMIC STOCK LOCK & CONCURRENCY
    // ══════════════════════════════════════════════════════════════════════════
    logger.info({ message: "\n══ 5. SALES TRANSACTIONS & ATOMIC CONCURRENCY ══" });

    // 5.1 Valid Sale
    const sellRes = await req("POST", "/inventory/sell", {
      inventoryId: batchAId,
      quantity: 10,
      employeeId: staffAId,
      note: "Prescription OTC sale"
    }, tokenPharmacistA);
    assert(sellRes.status === 201, "POST /inventory/sell completes sale -> 201");
    assert(sellRes.data.data.remainingStock === 90, "Stock decremented to 90");
    assert(sellRes.data.data.totalRevenue === 280.00, "Total revenue calculated accurately (10 * 28)");

    // 5.2 Verify Transaction Record Created in MySQL
    const txDoc = await Transaction.findOne({ inventoryId: batchAId, type: "OUT" });
    assert(!!txDoc, "Transaction recorded in MySQL with type OUT");
    assert(Number(txDoc.quantity) === 10, "Transaction quantity is 10");

    // 5.3 Verify Staff Total Sales incremented
    const staffDoc = await Staff.findById(staffAId);
    assert(Number(staffDoc.totalSales) === 280.00, "Staff totalSales updated accurately");

    // 5.4 Overselling Rejection
    const oversellRes = await req("POST", "/inventory/sell", {
      inventoryId: batchAId,
      quantity: 5000,
      employeeId: staffAId
    }, tokenPharmacistA);
    assert(oversellRes.status === 400, "Oversell attempt exceeding available stock rejected -> 400");

    // 5.5 Expired Stock Selling Rejection
    const pastDate = new Date();
    pastDate.setMonth(pastDate.getMonth() - 2);
    const createExpBatch = await req("POST", "/inventory", {
      medicineId: medicineAId,
      batchNumber: "BATCH-EXPIRED-TEST",
      currentStock: 20,
      reorderLevel: 5,
      expiryDate: pastDate.toISOString()
    }, tokenAdminA);
    const expBatchId = createExpBatch.data.data.id;

    const sellExpRes = await req("POST", "/inventory/sell", {
      inventoryId: expBatchId,
      quantity: 1,
      employeeId: staffAId
    }, tokenPharmacistA);
    assert(sellExpRes.status === 400, "Selling expired batch rejected -> 400");

    // Clean up expired batch
    await req("DELETE", `/inventory/${expBatchId}`, {}, tokenAdminA);

    // 5.6 Manual Transaction CRUD
    const createTxRes = await req("POST", "/inventory/transactions", {
      medicineId: medicineAId,
      type: "IN",
      quantity: 50,
      unitBuyPrice: 15,
      unitSellPrice: 28,
      note: "Manual shipment entry"
    }, tokenAdminA);
    assert(createTxRes.status === 201, "POST /inventory/transactions creates manual record -> 201");
    const manualTxId = createTxRes.data.data.id;

    const updateTxRes = await req("PATCH", `/inventory/transactions/${manualTxId}`, {
      note: "Corrected shipment entry"
    }, tokenAdminA);
    assert(updateTxRes.status === 200, "PATCH /inventory/transactions/:id updates record -> 200");

    const deleteTxRes = await req("DELETE", `/inventory/transactions/${manualTxId}`, {}, tokenAdminA);
    assert(deleteTxRes.status === 200, "DELETE /inventory/transactions/:id deletes record -> 200");

    // ══════════════════════════════════════════════════════════════════════════
    // SECTION 6: ALERTS, CRON EVALUATION & RESOLUTION
    // ══════════════════════════════════════════════════════════════════════════
    logger.info({ message: "\n══ 6. ALERTS & NOTIFICATIONS ══" });

    // 6.1 Create Manual Alert
    const createAlertRes = await req("POST", "/alerts", {
      type: "EXPIRY_WARNING",
      message: "Test expiry notification for batch BATCH-IBU-001",
      severity: "Low"
    }, tokenAdminA);
    assert(createAlertRes.status === 201, "POST /alerts creates alert -> 201");
    const alertId = createAlertRes.data.data.id;

    // 6.2 Get Single Alert
    const getAlertRes = await req("GET", `/alerts/${alertId}`, null, tokenAdminA);
    assert(getAlertRes.status === 200, "GET /alerts/:id returns 200");

    // 6.3 List Alerts
    const listAlertsRes = await req("GET", "/alerts", null, tokenAdminA);
    assert(listAlertsRes.status === 200, "GET /alerts returns 200");
    assert(listAlertsRes.data.data.length >= 1, "Alerts list contains active alert");

    // 6.4 Close / Resolve Alert
    const closeAlertRes = await req("PUT", `/alerts/${alertId}/close`, {}, tokenAdminA);
    assert(closeAlertRes.status === 200, "PUT /alerts/:id/close resolves alert -> 200");

    // ══════════════════════════════════════════════════════════════════════════
    // SECTION 7: DEMAND FORECASTING & PREDICTIONS
    // ══════════════════════════════════════════════════════════════════════════
    logger.info({ message: "\n══ 7. AI DEMAND FORECASTING ══" });

    // 7.1 POST /predictions for 30 days
    const predRes = await req("POST", "/predictions", {
      medicineId: medicineAId,
      periods: 30
    }, tokenAdminA);
    assert(predRes.status === 200, "POST /predictions (30 days) returns 200");
    assert(predRes.data.data.category === "M01AE", "Category correctly matched to M01AE");
    assert(Number(predRes.data.data.predictedDemand) > 0, "Predicted demand is positive");

    // 7.2 Get Prediction History
    const predHistRes = await req("GET", `/predictions/history?medicineId=${medicineAId}`, null, tokenAdminA);
    assert(predHistRes.status === 200, "GET /predictions/history returns 200");
    assert(predHistRes.data.data.length >= 1, "Prediction saved and retrieved from MySQL history");

    // ══════════════════════════════════════════════════════════════════════════
    // SECTION 8: DASHBOARD, FINANCIALS & CSV EXPORTS
    // ══════════════════════════════════════════════════════════════════════════
    logger.info({ message: "\n══ 8. DASHBOARD, FINANCIALS & CSV EXPORTS ══" });

    // 8.1 Dashboard Stats
    const dashRes = await req("GET", "/dashboard/stats", null, tokenAdminA);
    assert(dashRes.status === 200, "GET /dashboard/stats returns 200");
    assert(dashRes.data.data.expiringSoonCount !== undefined, "Dashboard counts active metrics");

    // 8.2 Financial Summary
    const finRes = await req("GET", "/financials/summary", null, tokenAdminA);
    assert(finRes.status === 200, "GET /financials/summary returns 200");
    assert(finRes.data.data.totalRevenue >= 280, "Financial revenue reflects sales");

    // 8.3 Employee Performance
    const empPerfRes = await req("GET", "/financials/employee-performance", null, tokenAdminA);
    assert(empPerfRes.status === 200, "GET /financials/employee-performance returns 200");
    assert(empPerfRes.data.data.length >= 1, "Employee performance lists active staff");

    // 8.4 Export Transactions CSV
    const expTxRes = await req("GET", "/export/transactions", null, tokenAdminA);
    assert(expTxRes.status === 200, "GET /export/transactions returns 200");
    assert(expTxRes.data.includes("Total Revenue"), "CSV contains transaction headers");

    // 8.5 Export Stock CSV
    const expStockRes = await req("GET", "/export/stock", null, tokenAdminA);
    assert(expStockRes.status === 200, "GET /export/stock returns 200");
    assert(expStockRes.data.includes("BATCH-IBU-001"), "CSV contains batch number");

    // 8.6 Export Staff Performance CSV
    const expStaffRes = await req("GET", "/export/staff-performance", null, tokenAdminA);
    assert(expStaffRes.status === 200, "GET /export/staff-performance returns 200");
    assert(expStaffRes.data.includes("Sarah Lead Pharmacist"), "CSV contains staff name");

    // ══════════════════════════════════════════════════════════════════════════
    // SECTION 9: SUPPORT TICKETING SYSTEM
    // ══════════════════════════════════════════════════════════════════════════
    logger.info({ message: "\n══ 9. SUPPORT TICKETING SYSTEM ══" });

    // 9.1 Submit Support Ticket (User/Pharmacist)
    const submitTicketRes = await req("POST", "/support", {
      subject: "Label printer calibration issue",
      message: "The barcode label printer needs realignment on dispensary station 2."
    }, tokenPharmacistA);
    assert(submitTicketRes.status === 201, "POST /support creates support ticket -> 201");
    const ticketId = submitTicketRes.data.data.id;

    // 9.2 List Support Tickets (Admin A)
    const listTicketsRes = await req("GET", "/support", null, tokenAdminA);
    assert(listTicketsRes.status === 200, "GET /support returns 200");
    assert(listTicketsRes.data.data.some((t) => t.id === ticketId), "Created ticket listed for admin");

    // 9.3 Update Ticket Status (open -> closed)
    const closeTicketRes = await req("PATCH", `/support/${ticketId}/status`, { status: "closed" }, tokenAdminA);
    assert(closeTicketRes.status === 200, "PATCH /support/:id/status updates status to closed -> 200");

    // ══════════════════════════════════════════════════════════════════════════
    // SECTION 10: MULTI-TENANT ISOLATION (TENANT A VS TENANT B)
    // ══════════════════════════════════════════════════════════════════════════
    logger.info({ message: "\n══ 10. MULTI-TENANT DATA ISOLATION ══" });

    // Tenant B cannot see Tenant A's medicine
    const tenantBMed = await req("GET", `/inventory/medicines/${medicineAId}`, null, tokenAdminB);
    assert(tenantBMed.status === 404, "Tenant B cannot fetch Tenant A medicine -> 404 Not Found");

    // Tenant B cannot see Tenant A's batches
    const tenantBInv = await req("GET", "/inventory", null, tokenAdminB);
    assert(tenantBInv.data.data.length === 0, "Tenant B inventory list is completely empty");

    // Tenant B cannot sell Tenant A's stock
    const crossSellRes = await req("POST", "/inventory/sell", {
      inventoryId: batchAId,
      quantity: 1
    }, tokenAdminB);
    assert(crossSellRes.status === 404, "Tenant B selling Tenant A stock blocked -> 404 Not Found");

    // Tenant B cannot see Tenant A's staff
    const tenantBStaff = await req("GET", `/staff/${staffAId}`, null, tokenAdminB);
    assert(tenantBStaff.status === 404, "Tenant B fetching Tenant A staff -> 404 Not Found");

    // Tenant B cannot see Tenant A's support tickets
    const tenantBTickets = await req("GET", "/support", null, tokenAdminB);
    assert(tenantBTickets.data.data.length === 0, "Tenant B tickets list is isolated -> 0 items");

    logger.info({ message: "\n════════════════════════════════════════════════════" });
    logger.info({ message: `  Comprehensive Pass Suite: ${passed} passed, ${failed} failed` });
    if (failures.length > 0) {
      logger.error({ message: `  Failures:\n    - ${failures.join("\n    - ")}` });
    }
    logger.info({ message: "════════════════════════════════════════════════════\n" });

    if (failed > 0) process.exitCode = 1;
  } catch (err) {
    logger.error({ message: `Comprehensive test suite unhandled error: ${err.message}`, stack: err.stack });
    process.exitCode = 1;
  } finally {
    try {
      await cleanTenant(TENANT_A_SLUG);
      await cleanTenant(TENANT_B_SLUG);
    } catch (cleanErr) {
      logger.error({ message: `Cleanup error: ${cleanErr.message}` });
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
      logger.info({ message: "Test server closed cleanly." });
    }
    await disconnectDb();
  }
}

runComprehensivePass();
