import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { Otp, User, Pharmacy, Staff } from "../models/index.js";
import { OtpService } from "../services/otpService.js";
import { emailService, MockEmailProvider } from "../services/emailService.js";
import { generateSecureTemporaryPassword } from "../utils/credentialGenerator.js";
import app from "../app.js";
import http from "http";

const TEST_PORT = 5098;
let server;
let baseUrl = `http://127.0.0.1:${TEST_PORT}/api/v1`;

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
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/pims");
    }
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  });

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.connection.close();
  });

  beforeEach(() => {
    emailService.setProvider(new MockEmailProvider());
    emailService.clearSentEmails();
  });

  it("1. Generates 6-digit numeric OTP and stores ONLY hashed OTP in MongoDB", async () => {
    const email = "doctor@testclinic.com";
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
    const dbRecord = await Otp.findOne({ email, purpose: "PHARMACY_REGISTRATION" });
    assert.ok(dbRecord);
    assert.ok(dbRecord.hashedOtp);
    assert.notEqual(dbRecord.hashedOtp, sentOtp); // Must be hashed!
    assert.ok(dbRecord.hashedOtp.startsWith("$2")); // Valid bcrypt hash prefix
    assert.equal(await bcrypt.compare(sentOtp, dbRecord.hashedOtp), true);

    // Verify 5-minute expiry
    const diffMs = new Date(dbRecord.expiresAt).getTime() - new Date().getTime();
    assert.ok(diffMs > 4 * 60 * 1000 && diffMs <= 5 * 60 * 1000);
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
      body: JSON.stringify({ email: "admin@hospital.com", password: "ChangeMe123!" })
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

  it("6. Staff Update & Delete Flow: requires and verifies OTP", async () => {
    // 1. Log in as admin
    const loginRes = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "admin@hospital.com", password: "ChangeMe123!" })
    });
    const token = loginRes.data.data.accessToken;

    const adminUser = await User.findOne({ email: "admin@hospital.com" });

    // Create temporary staff
    const staff = await Staff.create({
      pharmacyId: adminUser.pharmacyId,
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

  it("7. Settings Profile & Password Change Flow: requires and verifies purpose-based OTP", async () => {
    // 1. Log in
    const loginRes = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "admin@hospital.com", password: "ChangeMe123!" })
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
    const updatePassRes = await request("/auth/profile", {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        currentPassword: "ChangeMe123!",
        newPassword: "NewSecretPassword123!",
        otp: passOtp
      })
    });
    assert.equal(updatePassRes.status, 200);

    // 6. Verify login works with new password
    const newLogin = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "admin@hospital.com", password: "NewSecretPassword123!" })
    });
    assert.equal(newLogin.status, 200);

    // Restore original demo password
    const user = await User.findOne({ email: "admin@hospital.com" });
    user.password = await bcrypt.hash("ChangeMe123!", 10);
    await user.save();
  });
});
