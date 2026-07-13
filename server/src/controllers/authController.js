import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../config/jwt.js";
import env from "../config/env.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * Register a new user (pharmacist or administrator).
 * 
 * 1. Checks if the email is already in the database.
 * 2. Hashes the raw password using bcrypt (with 10 salt rounds) for security.
 * 3. Saves the new user record in MongoDB.
 */
export const register = asyncHandler(async (req, res) => {
  // Look up if a user already exists with the requested email
  const existing = await User.findOne({ email: req.body.email });
  if (existing) {
    return res.status(409).json({ success: false, message: "Email already registered" });
  }

  // Hash password using bcryptjs to ensure we never store plaintext passwords
  const hashedPassword = await bcrypt.hash(req.body.password, 10);
  
  // Create user record in the database
  const user = await User.create({ ...req.body, password: hashedPassword });
  
  // Respond with the newly created user details (excluding password)
  return res.status(201).json({ success: true, data: { id: user._id, email: user.email } });
});

/**
 * Log in an existing user.
 * 
 * 1. Finds the user by email.
 * 2. Compares the submitted password with the hashed password in the DB.
 * 3. Signs an access token (JWT) and refresh token.
 * 4. Stores the refresh token in an HTTP-only cookie for secure persistence.
 */
export const login = asyncHandler(async (req, res) => {
  // Search for the user by email
  const user = await User.findOne({ email: req.body.email });
  
  // Compare passwords using bcrypt.compare
  if (!user || !(await bcrypt.compare(req.body.password, user.password))) {
    return res.status(401).json({ success: false, message: "Invalid credentials" });
  }

  // Prepare payload for signing the JWT tokens
  const payload = { sub: user._id.toString(), role: user.role, email: user.email };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  // Set the refresh token in an HttpOnly cookie to protect against XSS attacks
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    sameSite: "strict",
    secure: env.nodeEnv === "production" // Only use HTTPS in production environment
  });

  // Return the access token and user metadata to the client
  return res.json({
    success: true,
    data: { user: { id: user._id, role: user.role, email: user.email, name: user.name }, accessToken }
  });
});

/**
 * Refresh an expired Access Token.
 * 
 * 1. Reads the HTTP-only cookie to retrieve the refresh token.
 * 2. Verifies the refresh token.
 * 3. Generates a fresh short-lived access token.
 */
export const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) {
    return res.status(401).json({ success: false, message: "No refresh token" });
  }
  
  try {
    // Validate refresh token using jwt secret
    const payload = verifyRefreshToken(token);
    
    // Generate a fresh access token for the authenticated user session
    const accessToken = signAccessToken({ sub: payload.sub, role: payload.role, email: payload.email });
    return res.json({ success: true, data: { accessToken } });
  } catch {
    return res.status(401).json({ success: false, message: "Invalid refresh token" });
  }
});

/**
 * Get profile details of the currently logged-in user.
 */
export const getProfile = asyncHandler(async (req, res) => {
  // Retrieve user matching sub ID in the JWT payload (exclude password hash from response)
  const user = await User.findById(req.user.sub).select("-password");
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }
  return res.json({ success: true, data: user });
});

/**
 * Update user profile details (Name, Email, or Password).
 */
export const updateProfile = asyncHandler(async (req, res) => {
  const { name, email, currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user.sub);

  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  // If updating password, verify current password
  if (newPassword) {
    if (!currentPassword || !(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(401).json({ success: false, message: "Current password is incorrect" });
    }
    user.password = await bcrypt.hash(newPassword, 10);
  }

  // Update email if provided and different, ensuring no duplicate emails exist
  if (email && email !== user.email) {
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, message: "Email already in use" });
    }
    user.email = email;
  }

  // Update name if provided
  if (name) {
    user.name = name;
  }

  await user.save();
  return res.json({ 
    success: true, 
    data: user.toObject({ transform: (doc, ret) => { delete ret.password; return ret; } }) 
  });
});

