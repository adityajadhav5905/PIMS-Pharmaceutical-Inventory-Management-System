import bcrypt from "bcryptjs";
import { Staff, User, Transaction, Pharmacy } from "../models/index.js";
import { getPharmacyDbId } from "../utils/tenantContext.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { OtpService } from "../services/otpService.js";
import { emailService } from "../services/emailService.js";
import { generateSecureTemporaryPassword } from "../utils/credentialGenerator.js";

/** Send OTP to current Admin for Staff management operations (add, edit, delete). */
export const sendStaffOtp = asyncHandler(async (req, res) => {
  const pharmacyDbId = getPharmacyDbId();
  const user = await User.findById(req.user.sub);
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  const { action, staffId, staffName } = req.body;
  let purpose = "STAFF_MUTATION";
  if (action === "create" || action === "add") purpose = "STAFF_CREATE";
  else if (action === "update" || action === "edit") purpose = "STAFF_UPDATE";
  else if (action === "delete" || action === "remove") purpose = "STAFF_DELETE";

  const details = `Authorization for staff ${action || "operation"}${staffName ? ` (${staffName})` : ""}`;

  const result = await OtpService.generateAndSendOtp({
    email: user.email,
    userId: user._id,
    pharmacyId: pharmacyDbId,
    purpose,
    targetEntityId: staffId || null,
    details
  });

  return res.json({
    success: true,
    message: result.message,
    expiresInMinutes: result.expiresInMinutes,
    purpose
  });
});

/** List all staff members or get single if req.params.id is present. */
export const getStaff = asyncHandler(async (req, res) => {
  const pharmacyDbId = getPharmacyDbId();

  if (req.params.id) {
    const staff = await Staff.findOne({ _id: req.params.id, pharmacyId: pharmacyDbId });
    if (!staff) {
      return res.status(404).json({ success: false, message: "Staff member not found" });
    }
    return res.json({
      success: true,
      data: {
        _id: staff._id,
        id: staff._id,
        name: staff.name,
        email: staff.email,
        position: staff.position,
        department: staff.department,
        salary: staff.salary,
        joinDate: staff.joinDate,
        totalSales: staff.totalSales,
        status: staff.status,
        createdAt: staff.createdAt
      }
    });
  }

  const staff = await Staff.find({ pharmacyId: pharmacyDbId }).sort({ createdAt: -1 });

  return res.json({
    success: true,
    data: staff.map((s) => ({
      _id: s._id,
      id: s._id,
      name: s.name,
      email: s.email,
      position: s.position,
      department: s.department,
      salary: s.salary,
      joinDate: s.joinDate,
      totalSales: s.totalSales,
      status: s.status,
      createdAt: s.createdAt
    }))
  });
});

export const listStaff = getStaff;

/** Create staff member. Only creates after successful OTP verification. */
export const createStaff = asyncHandler(async (req, res) => {
  const pharmacyDbId = getPharmacyDbId();
  const { name, email, position, department, salary, joinDate, password, otp } = req.body;
  const cleanEmail = email ? email.toLowerCase().trim() : "";

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: "Staff name is required." });
  }

  // 1. Check email conflicts before touching OTP
  if (cleanEmail) {
    const existingOtherUser = await User.findOne({ email: cleanEmail, pharmacyId: { $ne: pharmacyDbId } });
    if (existingOtherUser) {
      return res.status(409).json({
        success: false,
        message: "A user with this email address is already registered in another pharmacy workspace."
      });
    }

    const existingStaff = await Staff.findOne({ email: cleanEmail, pharmacyId: pharmacyDbId });
    if (existingStaff) {
      return res.status(409).json({
        success: false,
        message: `A staff member with email "${cleanEmail}" is already registered in your pharmacy.`
      });
    }
  }

  // 2. Verify admin OTP (mandatory)
  if (!otp || !String(otp).trim()) {
    return res.status(400).json({ success: false, message: "Security verification code (OTP) is required to create a staff member." });
  }

  const cleanOtp = String(otp).trim();
  try {
    await OtpService.verifyOtp({
      email: req.user.email,
      purpose: "STAFF_CREATE",
      otp: cleanOtp,
      consume: true
    });
  } catch (err) {
    if (err.message?.includes("No active verification code")) {
      await OtpService.verifyOtp({
        email: req.user.email,
        purpose: "STAFF_MUTATION",
        otp: cleanOtp,
        consume: true
      });
    } else {
      throw err;
    }
  }

  // 3. Create staff record
  const staff = await Staff.create({
    pharmacyId: pharmacyDbId,
    name: name.trim(),
    email: cleanEmail,
    position: position || "Pharmacist",
    department: department || "Dispensing",
    salary: salary || 0,
    joinDate: joinDate ? new Date(joinDate) : new Date(),
    status: "Active"
  });

  // 4. Automatically provision user credentials if email is provided
  let temporaryPassword = "";
  let emailDispatched = true;
  if (cleanEmail) {
    temporaryPassword = (password && password.trim().length >= 8)
      ? password.trim()
      : generateSecureTemporaryPassword();

    const passwordHash = await bcrypt.hash(temporaryPassword, 10);
    const role = (position || "").toLowerCase().includes("admin") ? "Admin" : "Pharmacist";

    const existingUser = await User.findOne({ email: cleanEmail, pharmacyId: pharmacyDbId });
    if (!existingUser) {
      await User.create({
        pharmacyId: pharmacyDbId,
        name: name.trim(),
        email: cleanEmail,
        password: passwordHash,
        role
      });
    } else {
      if (password && password.trim().length >= 8) {
        existingUser.password = passwordHash;
      }
      existingUser.role = role;
      existingUser.name = name.trim();
      existingUser.isActive = true;
      await existingUser.save();
    }

    // Dispatch temporary credentials to employee's email via emailService
    try {
      const pharmacy = await Pharmacy.findById(pharmacyDbId);
      await emailService.sendStaffCredentials({
        to: cleanEmail,
        staffName: name.trim(),
        pharmacyName: pharmacy?.name || "Our Pharmacy",
        email: cleanEmail,
        temporaryPassword,
        role
      });
    } catch {
      emailDispatched = false;
    }
  }

  return res.status(201).json({
    success: true,
    message: cleanEmail
      ? (emailDispatched
          ? `Staff member created. Login email: ${cleanEmail}. Temporary credentials dispatched to employee's email.`
          : `Staff member created. Login email: ${cleanEmail}. Note: Email dispatch encountered an SMTP issue.`)
      : "Staff member created successfully",
    data: {
      _id: staff._id,
      id: staff._id,
      name: staff.name,
      email: staff.email,
      position: staff.position,
      department: staff.department,
      salary: staff.salary,
      joinDate: staff.joinDate,
      totalSales: staff.totalSales,
      status: staff.status
    }
  });
});

/** Update staff member. Only updates after successful OTP verification. */
export const updateStaff = asyncHandler(async (req, res) => {
  const pharmacyDbId = getPharmacyDbId();
  const staffId = req.params.id;
  const { name, email, position, department, salary, status, password, otp } = req.body;

  const staff = await Staff.findOne({ _id: staffId, pharmacyId: pharmacyDbId });
  if (!staff) {
    return res.status(404).json({ success: false, message: "Staff member not found" });
  }

  // 1. Verify admin OTP first (mandatory)
  if (!otp || !String(otp).trim()) {
    return res.status(400).json({ success: false, message: "Security verification code (OTP) is required to update staff details." });
  }

  const cleanOtp = String(otp).trim();
  try {
    await OtpService.verifyOtp({
      email: req.user.email,
      purpose: "STAFF_UPDATE",
      targetEntityId: staffId,
      otp: cleanOtp,
      consume: true
    });
  } catch {
    try {
      await OtpService.verifyOtp({
        email: req.user.email,
        purpose: "STAFF_UPDATE",
        otp: cleanOtp,
        consume: true
      });
    } catch {
      await OtpService.verifyOtp({
        email: req.user.email,
        purpose: "STAFF_MUTATION",
        otp: cleanOtp,
        consume: true
      });
    }
  }

  const oldEmail = staff.email;

  if (name !== undefined) staff.name = name.trim();
  if (email !== undefined) staff.email = email.toLowerCase().trim();
  if (position !== undefined) staff.position = position;
  if (department !== undefined) staff.department = department;
  if (salary !== undefined) staff.salary = salary;
  if (status !== undefined) staff.status = status;

  await staff.save();

  // Sync with user login table if email or name changed
  if (oldEmail || email) {
    const targetEmail = oldEmail || (email ? email.toLowerCase().trim() : null);
    if (targetEmail) {
      const user = await User.findOne({ email: targetEmail, pharmacyId: pharmacyDbId });
      if (user) {
        if (name) user.name = name.trim();
        if (email) user.email = email.toLowerCase().trim();
        if (position) {
          user.role = position.toLowerCase().includes("admin") ? "Admin" : "Pharmacist";
        }
        if (status) {
          user.isActive = status === "Active";
        }
        if (password && password.trim().length >= 8) {
          user.password = await bcrypt.hash(password.trim(), 10);
        }
        await user.save();
      }
    }
  }

  return res.json({
    success: true,
    data: {
      _id: staff._id,
      id: staff._id,
      name: staff.name,
      email: staff.email,
      position: staff.position,
      department: staff.department,
      salary: staff.salary,
      status: staff.status
    }
  });
});

/** Delete staff member. Only deletes after successful OTP verification. */
export const deleteStaff = asyncHandler(async (req, res) => {
  const pharmacyDbId = getPharmacyDbId();
  const staffId = req.params.id;
  const otp = req.body?.otp || req.headers["x-otp"] || req.query?.otp;

  const staff = await Staff.findOne({ _id: staffId, pharmacyId: pharmacyDbId });
  if (!staff) {
    return res.status(404).json({ success: false, message: "Staff member not found" });
  }

  // 1. Verify admin OTP first (mandatory)
  if (!otp || !String(otp).trim()) {
    return res.status(400).json({ success: false, message: "Security verification code (OTP) is required to delete a staff member." });
  }

  const cleanOtp = String(otp).trim();
  try {
    await OtpService.verifyOtp({
      email: req.user.email,
      purpose: "STAFF_DELETE",
      targetEntityId: staffId,
      otp: cleanOtp,
      consume: true
    });
  } catch {
    try {
      await OtpService.verifyOtp({
        email: req.user.email,
        purpose: "STAFF_DELETE",
        otp: cleanOtp,
        consume: true
      });
    } catch {
      await OtpService.verifyOtp({
        email: req.user.email,
        purpose: "STAFF_MUTATION",
        otp: cleanOtp,
        consume: true
      });
    }
  }

  await Staff.deleteOne({ _id: staffId, pharmacyId: pharmacyDbId });

  // Also remove user credentials if exists
  if (staff.email) {
    await User.deleteMany({ email: staff.email, pharmacyId: pharmacyDbId });
  }

  return res.json({ success: true, message: "Staff member deleted successfully" });
});

/** Get aggregated sales per staff member. */
export const getStaffSales = asyncHandler(async (req, res) => {
  const pharmacyDbId = getPharmacyDbId();

  const salesStats = await Transaction.aggregate([
    { $match: { pharmacyId: pharmacyDbId, type: "OUT", employeeId: { $ne: null } } },
    {
      $group: {
        _id: "$employeeId",
        totalSales: { $sum: "$totalRevenue" },
        transactionCount: { $sum: 1 },
        totalProfit: { $sum: "$profit" }
      }
    }
  ]);

  const staffMembers = await Staff.find({ pharmacyId: pharmacyDbId });
  const map = new Map(salesStats.map((s) => [String(s._id), s]));

  const result = staffMembers.map((sm) => {
    const stat = map.get(String(sm._id));
    return {
      _id: sm._id,
      id: sm._id,
      name: sm.name,
      email: sm.email,
      position: sm.position,
      department: sm.department,
      totalSales: stat ? stat.totalSales : sm.totalSales || 0,
      transactionCount: stat ? stat.transactionCount : 0,
      totalProfit: stat ? stat.totalProfit : 0
    };
  });

  return res.json({
    success: true,
    data: result
  });
});
