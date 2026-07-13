import Alert from "../models/Alert.js";

export const listAlerts = async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    const status = req.query.status || "";
    const type = req.query.type || "";

    const filter = {};
    if (status) {
      filter.isResolved = status === "resolved";
    }
    if (type) {
      filter.type = type;
    }

    const [rows, total] = await Promise.all([
      Alert.find(filter)
        .populate("inventory")
        .populate("closedBy", "name email")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Alert.countDocuments(filter)
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

export const getAlert = async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id)
      .populate("inventory")
      .populate("closedBy", "name email");
    if (!alert) return res.status(404).json({ success: false, message: "Alert not found" });
    return res.json({ success: true, data: alert });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const closeAlert = async (req, res) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      {
        isResolved: true,
        closedAt: new Date(),
        closedBy: req.user.sub
      },
      { new: true }
    )
      .populate("inventory")
      .populate("closedBy", "name email");

    if (!alert) return res.status(404).json({ success: false, message: "Alert not found" });
    return res.json({ success: true, data: alert });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createAlert = async (req, res) => {
  try {
    const alert = await Alert.create(req.body);
    return res.status(201).json({ success: true, data: alert });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
