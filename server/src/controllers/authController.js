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
  const existingPharmacy = await Pharmacy.findOne({ slug: cleanSlug });
  if (existingPharmacy) {
    return res.status(409).json({
      success: false,
      message: "Pharmacy workspace with this identifier already exists."
    });
  }

  // 2. Verify email is available
  const existingUser = await User.findOne({ email: cleanEmail });
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
  const existingPharmacy = await Pharmacy.findOne({ slug: cleanSlug });
  if (existingPharmacy) {
    return res.status(409).json({
      success: false,
      message: "Pharmacy workspace with this identifier already exists. If you are an employee, ask your Pharmacy Admin to invite or add you through Staff Management."
    });
  }

  // 2. Check if email is already registered in the system
  const existingUser = await User.findOne({ email: cleanEmail });
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
    pharmacyId: newPharmacy._id,
    name,
    email: cleanEmail,
    password: hashedPassword,
    role: assignedRole
  });

  // 7. Create initial staff entry for workspace admin
  await Staff.create({
    pharmacyId: newPharmacy._id,
    name,
    email: cleanEmail,
    position: "System Admin",
    department: "Management",
    status: "Active"
  });

  return res.status(201).json({
    success: true,
    message: "Registration successful",
    data: { id: newUser._id, _id: newUser._id, email: newUser.email, role: assignedRole, pharmacyId: cleanSlug }
  });
});

/**
 * Log in an existing user.
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password, pharmacyId } = req.body;

  const cleanEmail = String(email || "").toLowerCase().trim();
  const users = await User.find({ email: cleanEmail, isActive: true }).populate("pharmacyId");

  if (users.length === 0) {
    return res.status(401).json({ success: false, message: "Invalid credentials" });
  }

  let user = null;
  if (users.length > 1) {
    const targetSlug = pharmacyId || req.headers["x-pharmacy-id"];
    user = users.find((u) => u.pharmacyId?.slug === targetSlug);
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

  const pharmacySlug = user.pharmacyId?.slug || "";
  const pharmacyName = user.pharmacyId?.name || "";

  const payload = {
    sub: user._id.toString(),
    role: user.role,
    email: user.email,
    pharmacyId: pharmacySlug
  };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  // Securely set refresh token ONLY in httpOnly cookie
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    sameSite: "strict",
    secure: env.nodeEnv === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  return res.json({
    success: true,
    data: {
      user: {
        id: user._id,
        _id: user._id,
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
  res.clearCookie("refreshToken", {
    httpOnly: true,
    sameSite: "strict",
    secure: env.nodeEnv === "production"
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
    userId: user._id,
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
  const user = await User.findById(req.user.sub).populate("pharmacyId");

  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  return res.json({
    success: true,
    data: {
      id: user._id,
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      pharmacyId: user.pharmacyId?.slug || ""
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

    user.password = await bcrypt.hash(newPassword, 10);
  }

  if (name) user.name = name;
  if (email && email.toLowerCase() !== user.email) {
    const existing = await User.findOne({ email: email.toLowerCase().trim(), _id: { $ne: user._id } });
    if (existing) {
      return res.status(409).json({ success: false, message: "Email is already in use by another account" });
    }
    user.email = email.toLowerCase().trim();
  }

  await user.save();

  // Also sync staff name & email if matching
  await Staff.updateMany(
    { pharmacyId: user.pharmacyId, email: user.email },
    { $set: { name: user.name, email: user.email } }
  );

  return res.json({
    success: true,
    message: "Profile updated successfully",
    data: {
      id: user._id,
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  });
});
