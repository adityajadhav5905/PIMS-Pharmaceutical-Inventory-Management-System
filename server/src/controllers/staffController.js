import Staff from "../models/Staff.js";

export const listStaff = async (req, res) => {
    try {
        const page = Number(req.query.page || 1);
        const limit = Number(req.query.limit || 10);
        const search = req.query.search?.trim() || "";
        const status = req.query.status || "";

        const filter = {};
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
                { position: { $regex: search, $options: "i" } }
            ];
        }
        if (status) {
            filter.status = status;
        }

        const [rows, total] = await Promise.all([
            Staff.find(filter)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit),
            Staff.countDocuments(filter)
        ]);

        return res.json({
            success: true,
            data: rows,
            meta: { page, limit, total, totalPages: Math.ceil(total / limit) }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getStaff = async (req, res) => {
    try {
        const staff = await Staff.findById(req.params.id);
        if (!staff) return res.status(404).json({ success: false, message: "Staff member not found" });
        return res.json({ success: true, data: staff });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const createStaff = async (req, res) => {
    try {
        const staff = await Staff.create(req.body);
        return res.status(201).json({ success: true, data: staff });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: "Email already exists" });
        }
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const updateStaff = async (req, res) => {
    try {
        const staff = await Staff.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!staff) return res.status(404).json({ success: false, message: "Staff member not found" });
        return res.json({ success: true, data: staff });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: "Email already exists" });
        }
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteStaff = async (req, res) => {
    try {
        const staff = await Staff.findByIdAndDelete(req.params.id);
        if (!staff) return res.status(404).json({ success: false, message: "Staff member not found" });
        return res.json({ success: true, message: "Staff member deleted" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getStaffSales = async (req, res) => {
    try {
        const staffMembers = await Staff.find({ status: "Active" }).sort({ totalSales: -1 });
        return res.json({ success: true, data: staffMembers });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
