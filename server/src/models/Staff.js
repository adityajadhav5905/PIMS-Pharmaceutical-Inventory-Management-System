import mongoose from "mongoose";

const staffSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        email: { type: String, required: true, unique: true, index: true },
        position: { type: String, required: true },
        department: { type: String, default: "General" },
        salary: { type: Number, default: 0 },
        joinDate: { type: Date, default: Date.now },
        status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
        phone: { type: String },
        totalSales: { type: Number, default: 0 },
        salesLastMonth: { type: Number, default: 0 }
    },
    { timestamps: true }
);

export default mongoose.model("Staff", staffSchema);
