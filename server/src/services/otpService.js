import crypto from "crypto";
import bcrypt from "bcryptjs";
import { Otp } from "../models/index.js";
import { emailService } from "./emailService.js";

/**
 * Reusable Purpose-Based OTP Service.
 * Generates 6-digit OTPs, securely stores only bcrypt hashes in MySQL,
 * handles 5-minute expiries, max 5 attempts rate-limiting, and target entity binding.
 */
export class OtpService {
  /**
   * Generate a 6-digit numeric OTP.
   */
  static generateNumericOtp() {
    return String(crypto.randomInt(100000, 1000000));
  }

  /**
   * Generate, hash, persist, and dispatch a purpose-based OTP.
   * Invalidates any previously active OTPs for the same user/purpose.
   */
  static async generateAndSendOtp({
    email,
    userId = null,
    pharmacyId = null,
    purpose,
    targetEntityId = null,
    targetPayload = null,
    details = ""
  }) {
    const cleanEmail = String(email || "").toLowerCase().trim();
    if (!cleanEmail) {
      const err = new Error("Email address is required for OTP dispatch");
      err.statusCode = 400;
      throw err;
    }

    if (!purpose) {
      const err = new Error("OTP purpose is required");
      err.statusCode = 400;
      throw err;
    }

    // 1. Invalidate previous pending OTPs for the same email and purpose (and targetEntityId if specified)
    await Otp.deleteByEmailAndPurpose(cleanEmail, purpose, targetEntityId || null);

    // 2. Generate 6-digit numeric OTP and hash it with bcrypt
    const rawOtp = this.generateNumericOtp();
    const hashedOtp = await bcrypt.hash(rawOtp, 10);

    // 3. Set exact 5-minute expiry
    const expiryMinutes = 5;
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    // 4. Persist in MySQL
    await Otp.create({
      email: cleanEmail,
      hashedOtp,
      purpose,
      userId,
      pharmacyId,
      targetEntityId: targetEntityId ? String(targetEntityId) : null,
      targetPayload,
      attempts: 0,
      maxAttempts: 5,
      expiresAt,
      verified: false
    });

    // 5. Dispatch OTP via Email Service abstraction
    await emailService.sendOtp({
      to: cleanEmail,
      otp: rawOtp,
      purpose,
      expiryMinutes,
      details
    });

    return {
      success: true,
      message: `A 6-digit verification code has been sent to ${cleanEmail}. Valid for ${expiryMinutes} minutes.`,
      expiresInMinutes: expiryMinutes,
      purpose
    };
  }

  /**
   * Verify an OTP supplied for a specific user, purpose, and optional target entity.
   * Consumes (deletes) the OTP upon successful verification.
   */
  static async verifyOtp({
    email,
    purpose,
    otp,
    userId = null,
    pharmacyId = null,
    targetEntityId = null,
    consume = true
  }) {
    const cleanEmail = String(email || "").toLowerCase().trim();
    const cleanOtp = String(otp || "").trim();

    if (!cleanOtp) {
      const err = new Error("Verification code (OTP) is required");
      err.statusCode = 400;
      throw err;
    }

    if (!cleanEmail) {
      const err = new Error("Email address is required for OTP verification");
      err.statusCode = 400;
      throw err;
    }

    // Query for active OTP record
    const record = await Otp.findLatest(cleanEmail, purpose, targetEntityId || null);

    if (!record) {
      const err = new Error("No active verification code found. Please request a new OTP.");
      err.statusCode = 400;
      throw err;
    }

    // Check expiration
    if (new Date() > new Date(record.expiresAt)) {
      await Otp.deleteById(record.id);
      const err = new Error("Verification code has expired. Please request a new one.");
      err.statusCode = 400;
      throw err;
    }

    // Check attempt limits
    if (record.attempts >= record.maxAttempts) {
      await Otp.deleteById(record.id);
      const err = new Error("Too many failed attempts. This verification code is no longer valid. Please request a new one.");
      err.statusCode = 400;
      throw err;
    }

    // Verify hash
    const isMatch = await bcrypt.compare(cleanOtp, record.hashedOtp);

    if (!isMatch) {
      const newAttempts = record.attempts + 1;
      await Otp.updateById(record.id, { attempts: newAttempts });
      const remainingAttempts = Math.max(0, record.maxAttempts - newAttempts);
      const err = new Error(`Incorrect verification code. ${remainingAttempts} attempt(s) remaining.`);
      err.statusCode = 400;
      throw err;
    }

    // Bind validation: verify pharmacyId match if bound
    if (pharmacyId && record.pharmacyId && String(pharmacyId) !== String(record.pharmacyId)) {
      const err = new Error("OTP verification workspace mismatch");
      err.statusCode = 403;
      throw err;
    }

    // Successfully verified -> consume OTP so it cannot be reused
    if (consume) {
      await Otp.deleteById(record.id);
    } else {
      await Otp.updateById(record.id, { verified: 1 });
    }

    return {
      valid: true,
      email: cleanEmail,
      purpose,
      targetEntityId: record.targetEntityId,
      targetPayload: record.targetPayload
    };
  }
}

export default OtpService;
