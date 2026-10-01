import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { connectDb, disconnectDb } from "../config/db.js";
import { Otp, User, Pharmacy, Staff } from "../models/index.js";
import { OtpService } from "../services/otpService.js";
import { emailService, MockEmailProvider } from "../services/emailService.js";
import app from "../app.js";
import http from "http";

const TEST_PORT = 5098;
let server;
let baseUrl = `http://127.0.0.1:${TEST_PORT}/api/v1`;

const TEST_ADMIN_EMAIL = "otp_suite_admin@testclinic.com";
const TEST_ADMIN_PASSWORD = "SuiteAdminSecretPass123!";
const TEST_PHARMACY_SLUG = "otp-suite-pharmacy";

let suitePharmacy;
let suiteAdminUser;

const request = async (path, options = {}) => {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    }
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
};

describe("══ PIMS OTP & CREDENTIAL GENERATION VERIFICATION SUITE ══", () => {
  before(async () => {
    emailService.setProvider(new MockEmailProvider());
    await connectDb();

    // Set up test pharmacy and admin user
    const existingP = await Pharmacy.findOne({ slug: TEST_PHARMACY_SLUG });
    if (existingP) {
      await Staff.deleteByPharmacy(existingP._id);
      await User.deleteByPharmacy(existingP._id);
      await Pharmacy.deleteById(existingP._id);
    }
    await User.deleteByEmails([TEST_ADMIN_EMAIL]);
    await Staff.deleteByEmails([TEST_ADMIN_EMAIL]);

    suitePharmacy = await Pharmacy.create({
      slug: TEST_PHARMACY_SLUG,
      name: "OTP Test Pharmacy"
    });

    const hashedPassword = await bcrypt.hash(TEST_ADMIN_PASSWORD, 10);
    suiteAdminUser = await User.create({
      pharmacyId: suitePharmacy._id,
      name: "OTP Test Admin",
      email: TEST_ADMIN_EMAIL,
      password: hashedPassword,
      role: "Admin"
    });

    await Staff.create({
      pharmacyId: suitePharmacy._id,
      name: "OTP Test Admin",
      email: TEST_ADMIN_EMAIL,
      position: "System Admin",
      department: "Management",
      status: "Active"
    });

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  });

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (suitePharmacy) {
      await Staff.deleteByPharmacy(suitePharmacy._id);
      await User.deleteByPharmacy(suitePharmacy._id);
      await Pharmacy.deleteById(suitePharmacy._id);
    }
    await Otp.deleteAll();
    await disconnectDb();
  });

  beforeEach(() => {
    emailService.setProvider(new MockEmailProvider());
    emailService.clearSentEmails();
  });

  it("1. Generates 6-digit numeric OTP and stores ONLY hashed OTP in MySQL", async () => {
    const email = "doctor@testclinic.com";
    const generationTime = Date.now();
    const res = await OtpService.generateAndSendOtp({
      email,
      purpose: "PHARMACY_REGISTRATION",
      details: "Test Pharmacy"
    });

    assert.equal(res.success, true);
    assert.equal(res.expiresInMinutes, 5);

    // Verify email was dispatched
    const lastEmail = emailService.getLastSentEmail();
    assert.ok(lastEmail);
    assert.equal(lastEmail.to, email);
    const sentOtp = lastEmail.metadata.otp;
    assert.match(sentOtp, /^\d{6}$/);

    // Verify DB record stores hashedOtp and NOT plaintext
    const dbRecord = await Otp.findLatest(email, "PHARMACY_REGISTRATION");
    assert.ok(dbRecord);
    assert.ok(dbRecord.hashedOtp);
    assert.notEqual(dbRecord.hashedOtp, sentOtp);
    assert.ok(dbRecord.hashedOtp.startsWith("$2"));
    assert.equal(await bcrypt.compare(sentOtp, dbRecord.hashedOtp), true);

    // Verify 5-minute expiry relative to generation timestamp
    const expiryTime = new Date(dbRecord.expiresAt).getTime();
    const diffMs = expiryTime - generationTime;
    const expectedMs = 5 * 60 * 1000;
    const toleranceMs = 30 * 1000;

    assert.ok(
      Math.abs(diffMs - expectedMs) <= toleranceMs,
      `OTP expiry was ${diffMs}ms after generation; expected approximately ${expectedMs}ms`
    );
  });

  it("2. Invalidates previous OTPs when a new OTP is requested for the same user/purpose", async () => {
    const email = "repeat@testclinic.com";
    await OtpService.generateAndSendOtp({ email, purpose: "SETTINGS_UPDATE" });
    const firstOtpEmail = emailService.getLastSentEmail();
    const firstOtp = firstOtpEmail.metadata.otp;

    await OtpService.generateAndSendOtp({ email, purpose: "SETTINGS_UPDATE" });
    const secondOtpEmail = emailService.getLastSentEmail();
    const secondOtp = secondOtpEmail.metadata.otp;

    // First OTP must be invalid now
    await assert.rejects(
      () => OtpService.verifyOtp({ email, purpose: "SETTINGS_UPDATE", otp: firstOtp }),
      /Incorrect verification code|No active verification code/
    );

    // Second OTP must verify cleanly
    const verifyRes = await OtpService.verifyOtp({ email, purpose: "SETTINGS_UPDATE", otp: secondOtp });
    assert.equal(verifyRes.valid, true);
  });

  it("3. Enforces maximum 5 attempts rate-limiting on incorrect OTP entries", async () => {
    const email = "security@testclinic.com";
    await OtpService.generateAndSendOtp({ email, purpose: "CHANGE_PASSWORD" });

    // Attempt 1 to 4 with incorrect code
    for (let i = 1; i <= 4; i++) {
      await assert.rejects(
        () => OtpService.verifyOtp({ email, purpose: "CHANGE_PASSWORD", otp: "000000" }),
        new RegExp(`${5 - i} attempt\\(s\\) remaining`)
      );
    }

    // Attempt 5 with incorrect code
    await assert.rejects(
      () => OtpService.verifyOtp({ email, purpose: "CHANGE_PASSWORD", otp: "000000" }),
      /0 attempt\(s\) remaining/
    );

    // Attempt 6 (over limit) -> invalidates and deletes
    await assert.rejects(
      () => OtpService.verifyOtp({ email, purpose: "CHANGE_PASSWORD", otp: "000000" }),
      /Too many failed attempts/
    );

    // Subsequent attempt should find no active code
    await assert.rejects(
      () => OtpService.verifyOtp({ email, purpose: "CHANGE_PASSWORD", otp: "123456" }),
      /No active verification code found/
    );
  });

  it("4. Pharmacy Registration Flow: sends OTP, verifies OTP, and creates workspace", async () => {
    const regEmail = `admin-${Date.now()}@newclinic.com`;
    const pharmacyId = `clinic-${Date.now()}`;

    // 1. Request Registration OTP
    const otpRes = await request("/auth/send-registration-otp", {
      method: "POST",
      body: JSON.stringify({ email: regEmail, pharmacyId, name: "Dr. Clinic Admin" })
    });
    assert.equal(otpRes.status, 200);

    const sentEmail = emailService.getLastSentEmail();
    assert.ok(sentEmail);
    const otp = sentEmail.metadata.otp;

    // 2. Reject registration with wrong OTP
    const badReg = await request("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: "Dr. Clinic Admin",
        email: regEmail,
        password: "Password123!",
        pharmacyId,
        otp: "999999"
      })
    });
    assert.equal(badReg.status, 400);

    // 3. Complete registration with valid OTP
    const goodReg = await request("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: "Dr. Clinic Admin",
        email: regEmail,
        password: "Password123!",
        pharmacyId,
        otp
      })
    });
    assert.equal(goodReg.status, 201);
    assert.equal(goodReg.data.data.email, regEmail);
  });

  it("5. Staff Creation Flow: generates temporary password, sends credentials email, and enforces OTP", async () => {
    // 1. Log in as admin
    const loginRes = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD })
    });
    assert.equal(loginRes.status, 200);
    const token = loginRes.data.data.accessToken;

    // 2. Request OTP for STAFF_CREATE
    const otpReq = await request("/staff/send-otp", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "create" })
    });
    assert.equal(otpReq.status, 200);

    const adminOtpEmail = emailService.getLastSentEmail();
    assert.ok(adminOtpEmail);
    const otp = adminOtpEmail.metadata.otp;

    // 3. Create staff with OTP
    const staffEmail = `nurse-${Date.now()}@hospital.com`;
    const createRes = await request("/staff", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: "Nurse Alice",
        email: staffEmail,
        position: "Pharmacist",
        department: "Dispensary",
        salary: 45000,
        otp
      })
    });
    assert.equal(createRes.status, 201);

    // 4. Verify credentials email was dispatched to Alice with generated password
    const credentialsEmail = emailService.getLastSentEmail();
    assert.ok(credentialsEmail);
    assert.equal(credentialsEmail.to, staffEmail);
    assert.equal(credentialsEmail.metadata.type, "STAFF_CREDENTIALS");
    const tempPassword = credentialsEmail.metadata.temporaryPassword;
    assert.ok(tempPassword.length >= 8);

    // 5. Test Alice can log in with her dispatched temporary credentials
    const staffLogin = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: staffEmail, password: tempPassword })
    });
    assert.equal(staffLogin.status, 200);
    assert.equal(staffLogin.data.data.user.email, staffEmail);
  });

  it("6. Staff Creation Rejection: fails with 400 on missing, empty, or invalid OTP", async () => {
    const loginRes = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD })
    });
    const token = loginRes.data.data.accessToken;

    // Missing OTP
    const resNoOtp = await request("/staff", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: "Staff Missing OTP",
        email: `missing-otp-${Date.now()}@testclinic.com`,
        position: "Pharmacist"
      })
    });
    assert.equal(resNoOtp.status, 400);
    assert.match(resNoOtp.data.message, /OTP.*required/i);

    // Empty string OTP
    const resEmptyOtp = await request("/staff", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: "Staff Empty OTP",
        email: `empty-otp-${Date.now()}@testclinic.com`,
        position: "Pharmacist",
        otp: "   "
      })
    });
    assert.equal(resEmptyOtp.status, 400);
    assert.match(resEmptyOtp.data.message, /OTP.*required/i);

    // Invalid OTP
    const resInvalidOtp = await request("/staff", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: "Staff Invalid OTP",
        email: `invalid-otp-${Date.now()}@testclinic.com`,
        position: "Pharmacist",
        otp: "999999"
      })
    });
    assert.equal(resInvalidOtp.status, 400);
  });

  it("7. Staff Update & Delete Rejection: fails with 400 on missing or invalid OTP", async () => {
    const loginRes = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD })
    });
    const token = loginRes.data.data.accessToken;

    const staff = await Staff.create({
      pharmacyId: suitePharmacy._id,
      name: "Otp Guard Staff",
      email: `guard-staff-${Date.now()}@testclinic.com`,
      position: "Pharmacist"
    });

    // Update with missing OTP
    const updateNoOtp = await request(`/staff/${staff._id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: "Updated Without OTP" })
    });
    assert.equal(updateNoOtp.status, 400);
    assert.match(updateNoOtp.data.message, /OTP.*required/i);

    // Update with invalid OTP
    const updateBadOtp = await request(`/staff/${staff._id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: "Updated Bad OTP", otp: "000000" })
    });
    assert.equal(updateBadOtp.status, 400);

    // Delete with missing OTP
    const deleteNoOtp = await request(`/staff/${staff._id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(deleteNoOtp.status, 400);
    assert.match(deleteNoOtp.data.message, /OTP.*required/i);

    // Delete with invalid OTP
    const deleteBadOtp = await request(`/staff/${staff._id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ otp: "000000" })
    });
    assert.equal(deleteBadOtp.status, 400);
  });

  it("8. Staff Update & Delete Flow: requires and verifies valid OTP", async () => {
    // 1. Log in as admin
    const loginRes = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD })
    });
    const token = loginRes.data.data.accessToken;

    // Create temporary staff
    const staff = await Staff.create({
      pharmacyId: suitePharmacy._id,
      name: "Temporary Worker",
      email: `temp-${Date.now()}@hospital.com`,
      position: "Pharmacist"
    });

    // 2. Request OTP for edit
    await request("/staff/send-otp", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "update", staffId: staff._id })
    });
    const editOtp = emailService.getLastSentEmail().metadata.otp;

    // 3. Update staff with OTP
    const updateRes = await request(`/staff/${staff._id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: "Updated Worker", salary: 50000, otp: editOtp })
    });
    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.data.data.name, "Updated Worker");

    // 4. Request OTP for delete
    await request("/staff/send-otp", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "delete", staffId: staff._id })
    });
    const deleteOtp = emailService.getLastSentEmail().metadata.otp;

    // 5. Delete staff with OTP
    const deleteRes = await request(`/staff/${staff._id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ otp: deleteOtp })
    });
    assert.equal(deleteRes.status, 200);
  });

  it("9. Settings Profile & Password Change Flow: requires and verifies purpose-based OTP", async () => {
    // 1. Log in
    const loginRes = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD })
    });
    const token = loginRes.data.data.accessToken;

    // 2. Request OTP for CHANGE_NAME
    await request("/auth/send-settings-otp", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "CHANGE_NAME" })
    });
    const nameOtp = emailService.getLastSentEmail().metadata.otp;

    // 3. Update Name with OTP
    const updateNameRes = await request("/auth/profile", {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: "Hospital System Administrator", otp: nameOtp })
    });
    assert.equal(updateNameRes.status, 200);
    assert.equal(updateNameRes.data.data.name, "Hospital System Administrator");

    // 4. Request OTP for CHANGE_PASSWORD
    await request("/auth/send-settings-otp", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "CHANGE_PASSWORD" })
    });
    const passOtp = emailService.getLastSentEmail().metadata.otp;

    // 5. Update Password with OTP
    const newPassword = "NewSecretPassword123!";
    const updatePassRes = await request("/auth/profile", {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        currentPassword: TEST_ADMIN_PASSWORD,
        newPassword,
        otp: passOtp
      })
    });
    assert.equal(updatePassRes.status, 200);

    // 6. Verify login works with new password
    const newLogin = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: TEST_ADMIN_EMAIL, password: newPassword })
    });
    assert.equal(newLogin.status, 200);
  });
});
