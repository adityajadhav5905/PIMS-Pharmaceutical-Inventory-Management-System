import bcrypt from "bcryptjs";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../config/jwt.js";
import env from "../config/env.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Pharmacy, User, Staff } from "../models/index.js";
import { OtpService } from "../services/otpService.js";

/**
 * Send OTP for Pharmacy Creation / Registration.
 */
export const sendRegistrationOtp = asyncHandler(async (req, res) => {
  const { email, pharmacyId, name } = req.body;

  if (!email || !pharmacyId) {
    return res.status(400).json({ success: false, message: "Email and Pharmacy ID are required" });
  }

  const cleanSlug = pharmacyId.toLowerCase().trim().replace(/[^a-z0-9-]/g, "-");
  const cleanEmail = email.toLowerCase().trim();

  // 1. Verify pharmacy workspace identifier is available
  const existingPharmacy = await Pharmacy.findBySlug(cleanSlug);
  if (existingPharmacy) {
    return res.status(409).json({
      success: false,
      message: "Pharmacy workspace with this identifier already exists."
    });
  }

  // 2. Verify email is available
  const existingUser = await User.findByEmail(cleanEmail);
  if (existingUser) {
    return res.status(409).json({
      success: false,
      message: "Email is already registered. Please log in instead."
    });
  }

  const result = await OtpService.generateAndSendOtp({
    email: cleanEmail,
    purpose: "PHARMACY_REGISTRATION",
    details: `Creation of pharmacy workspace '${cleanSlug}' by ${name || "Administrator"}`
  });

  return res.json({
    success: true,
    message: result.message,
    expiresInMinutes: result.expiresInMinutes
  });
});

/**
 * Register a new user and pharmacy workspace.
 * Only creates records after successful OTP verification (if OTP provided or required).
 */
export const register = asyncHandler(async (req, res) => {
  const { name, email, password, pharmacyId, otp } = req.body;

  if (!pharmacyId) {
    return res.status(400).json({ success: false, message: "Pharmacy workspace ID is required" });
  }

  const cleanSlug = pharmacyId.toLowerCase().trim().replace(/[^a-z0-9-]/g, "-");
  const cleanEmail = email.toLowerCase().trim();

  // 1. Verify that the pharmacy workspace identifier is not already taken
  const existingPharmacy = await Pharmacy.findBySlug(cleanSlug);
  if (existingPharmacy) {
    return res.status(409).json({
      success: false,
      message: "Pharmacy workspace with this identifier already exists. If you are an employee, ask your Pharmacy Admin to invite or add you through Staff Management."
    });
  }

  // 2. Check if email is already registered in the system
  const existingUser = await User.findByEmail(cleanEmail);
  if (existingUser) {
    return res.status(409).json({ success: false, message: "Email already registered in system" });
  }

  if (!otp || !String(otp).trim()) {
    return res.status(400).json({ success: false, message: "Verification code (OTP) is required for registration" });
  }

  // 3. Perform OTP verification (mandatory)
  await OtpService.verifyOtp({
    email: cleanEmail,
    purpose: "PHARMACY_REGISTRATION",
    otp: String(otp).trim()
  });

  // 4. Create the new pharmacy workspace (creator is assigned Admin)
  const assignedRole = "Admin";
  const formattedName = cleanSlug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

  const newPharmacy = await Pharmacy.create({
    slug: cleanSlug,
    name: formattedName
  });

  // 5. Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // 6. Save new user record
  const newUser = await User.create({
    pharmacyId: newPharmacy.id,
    name,
    email: cleanEmail,
    password: hashedPassword,
    role: assignedRole
  });

  // 7. Create initial staff entry for workspace admin
  await Staff.create({
    pharmacyId: newPharmacy.id,
    name,
    email: cleanEmail,
    position: "System Admin",
    department: "Management",
    status: "Active"
  });

  return res.status(201).json({
    success: true,
    message: "Registration successful",
    data: { id: newUser.id, _id: newUser.id, email: newUser.email, role: assignedRole, pharmacyId: cleanSlug }
  });
});

/**
 * Log in an existing user.
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password, pharmacyId } = req.body;

  const cleanEmail = String(email || "").toLowerCase().trim();
  const users = await User.findActiveByEmail(cleanEmail);

  if (users.length === 0) {
    return res.status(401).json({ success: false, message: "Invalid credentials" });
  }

  let user = null;
  if (users.length > 1) {
    const targetSlug = pharmacyId || req.headers["x-pharmacy-id"];
    user = users.find((u) => u.pharmacySlug === targetSlug);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Ambiguous login. Please specify your Pharmacy ID workspace slug."
      });
    }
  } else {
    user = users[0];
  }

  if (!(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ success: false, message: "Invalid credentials" });
  }

  const pharmacySlug = user.pharmacySlug || "";
  const pharmacyName = user.pharmacyName || "";

  const payload = {
    sub: String(user.id),
    role: user.role,
    email: user.email,
    pharmacyId: pharmacySlug
  };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  const isProd = env.nodeEnv === "production";

  // Securely set refresh token ONLY in httpOnly cookie
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  return res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        _id: user.id,
        role: user.role,
        email: user.email,
        name: user.name,
        pharmacyId: pharmacySlug,
        pharmacyName
      },
      accessToken
    }
  });
});

/**
 * Log out user and clear refresh token cookie.
 */
export const logout = asyncHandler(async (req, res) => {
  const isProd = env.nodeEnv === "production";
  res.clearCookie("refreshToken", {
    httpOnly: true,
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
    path: "/"
  });
  return res.json({ success: true, message: "Logged out successfully" });
});

/**
 * Refresh an expired Access Token.
 * Accepts refresh token strictly via secure httpOnly cookie.
 */
export const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) {
    return res.status(401).json({ success: false, message: "No refresh token provided in HTTP-only cookie" });
  }

  try {
    const payload = verifyRefreshToken(token);
    const accessToken = signAccessToken({
      sub: payload.sub,
      role: payload.role,
      email: payload.email,
      pharmacyId: payload.pharmacyId
    });
    return res.json({ success: true, data: { accessToken } });
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired refresh token" });
  }
});

/**
 * Send OTP for Settings Profile / Password / Name changes.
 */
export const sendSettingsOtp = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.sub);
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  const { action } = req.body;
  let purpose = "SETTINGS_UPDATE";
  if (action === "CHANGE_NAME") purpose = "CHANGE_NAME";
  else if (action === "CHANGE_PASSWORD") purpose = "CHANGE_PASSWORD";

  const result = await OtpService.generateAndSendOtp({
    email: user.email,
    userId: user.id,
    pharmacyId: user.pharmacyId,
    purpose,
    details: `Authorization to update account: ${purpose}`
  });

  return res.json({
    success: true,
    message: result.message,
    expiresInMinutes: result.expiresInMinutes,
    purpose
  });
});

/**
 * Get profile details of currently logged-in user.
 */
export const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findByIdWithPharmacy(req.user.sub);

  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  return res.json({
    success: true,
    data: {
      id: user.id,
      _id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      pharmacyId: user.pharmacySlug || ""
    }
  });
});

/**
 * Update user profile (name, email, password).
 * Enforces action-specific OTP verification before performing database modifications.
 */
export const updateProfile = asyncHandler(async (req, res) => {
  const { name, email, currentPassword, newPassword, otp, nameOtp, passwordOtp } = req.body;
  const user = await User.findById(req.user.sub);

  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  const updates = {};

  // 1. If changing name: verify OTP (mandatory)
  const isNameChanging = name && name.trim() !== user.name;
  if (isNameChanging) {
    const code = nameOtp || otp;
    if (!code) {
      return res.status(400).json({ success: false, message: "Verification code (OTP) is required to update account name" });
    }
    await OtpService.verifyOtp({
      email: user.email,
      purpose: "CHANGE_NAME",
      otp: code
    }).catch(async (err) => {
      // Fallback to SETTINGS_UPDATE if generated under generic settings purpose
      if (err.message?.includes("No active verification code")) {
        await OtpService.verifyOtp({
          email: user.email,
          purpose: "SETTINGS_UPDATE",
          otp: code
        });
      } else {
        throw err;
      }
    });
    updates.name = name;
  }

  // 2. If changing password: verify current password + verify OTP (mandatory)
  if (newPassword) {
    if (!currentPassword) {
      return res.status(400).json({ success: false, message: "Current password is required to set new password" });
    }
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Current password is incorrect" });
    }

    const code = passwordOtp || otp;
    if (!code) {
      return res.status(400).json({ success: false, message: "Verification code (OTP) is required to change password" });
    }

    await OtpService.verifyOtp({
      email: user.email,
      purpose: "CHANGE_PASSWORD",
      otp: code
    }).catch(async (err) => {
      if (err.message?.includes("No active verification code")) {
        await OtpService.verifyOtp({
          email: user.email,
          purpose: "SETTINGS_UPDATE",
          otp: code
        });
      } else {
        throw err;
      }
    });

    updates.password = await bcrypt.hash(newPassword, 10);
  }

  if (email && email.toLowerCase() !== user.email) {
    const existing = await User.findByEmailExcluding(email, user.id);
    if (existing) {
      return res.status(409).json({ success: false, message: "Email is already in use by another account" });
    }
    updates.email = email.toLowerCase().trim();
  }

  if (name && !updates.name) {
    updates.name = name;
  }

  if (Object.keys(updates).length > 0) {
    await User.updateById(user.id, updates);
  }

  // Also sync staff name & email if matching
  const updatedName = updates.name || user.name;
  const updatedEmail = updates.email || user.email;
  const staffRecord = await Staff.findByEmailAndPharmacy(user.email, user.pharmacyId);
  if (staffRecord) {
    await Staff.updateById(staffRecord.id, { name: updatedName, email: updatedEmail });
  }

  return res.json({
    success: true,
    message: "Profile updated successfully",
    data: {
      id: user.id,
      _id: user.id,
      name: updatedName,
      email: updatedEmail,
      role: user.role
    }
  });
});
