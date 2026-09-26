import bcrypt from "bcryptjs";
import { Staff, User, Transaction } from "../models/index.js";
import { getPharmacyDbId } from "../utils/tenantContext.js";
import { asyncHandler } from "../utils/asyncHandler.js";

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

/** Create staff member. */
export const createStaff = asyncHandler(async (req, res) => {
  const pharmacyDbId = getPharmacyDbId();
  const { name, email, position, department, salary, joinDate } = req.body;

  const cleanEmail = email ? email.toLowerCase().trim() : "";

  // 1. Create staff record
  const staff = await Staff.create({
    pharmacyId: pharmacyDbId,
    name,
    email: cleanEmail,
    position: position || "Pharmacist",
    department: department || "Dispensing",
    salary: salary || 0,
    joinDate: joinDate ? new Date(joinDate) : new Date(),
    status: "Active"
  });

  // 2. Automatically provision user credentials if email is provided
  if (cleanEmail) {
    const existingUser = await User.findOne({ email: cleanEmail });
    if (!existingUser) {
      const defaultPasswordHash = await bcrypt.hash("ChangeMe123!", 10);
      const role = (position || "").toLowerCase().includes("admin") ? "Admin" : "Pharmacist";
      await User.create({
        pharmacyId: pharmacyDbId,
        name,
        email: cleanEmail,
        password: defaultPasswordHash,
        role
      });
    }
  }

  return res.status(201).json({
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
      status: staff.status
    }
  });
});

/** Update staff member. */
export const updateStaff = asyncHandler(async (req, res) => {
  const pharmacyDbId = getPharmacyDbId();
  const staffId = req.params.id;

  const staff = await Staff.findOne({ _id: staffId, pharmacyId: pharmacyDbId });
  if (!staff) {
    return res.status(404).json({ success: false, message: "Staff member not found" });
  }

  const { name, email, position, department, salary, status } = req.body;
  const oldEmail = staff.email;

  if (name !== undefined) staff.name = name;
  if (email !== undefined) staff.email = email.toLowerCase().trim();
  if (position !== undefined) staff.position = position;
  if (department !== undefined) staff.department = department;
  if (salary !== undefined) staff.salary = salary;
  if (status !== undefined) staff.status = status;

  await staff.save();

  // Sync with user login table if email or name changed
  if (oldEmail) {
    const user = await User.findOne({ email: oldEmail, pharmacyId: pharmacyDbId });
    if (user) {
      if (name) user.name = name;
      if (email) user.email = email.toLowerCase().trim();
      if (position) {
        user.role = position.toLowerCase().includes("admin") ? "Admin" : "Pharmacist";
      }
      if (status) {
        user.isActive = status === "Active";
      }
      await user.save();
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

/** Delete staff member. */
export const deleteStaff = asyncHandler(async (req, res) => {
  const pharmacyDbId = getPharmacyDbId();
  const staffId = req.params.id;

  const staff = await Staff.findOneAndDelete({ _id: staffId, pharmacyId: pharmacyDbId });
  if (!staff) {
    return res.status(404).json({ success: false, message: "Staff member not found" });
  }

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
