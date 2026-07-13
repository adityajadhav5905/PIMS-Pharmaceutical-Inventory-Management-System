import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["Admin", "Pharmacist"], default: "Pharmacist" }
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
