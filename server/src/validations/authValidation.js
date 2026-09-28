import Joi from "joi";

export const registerSchema = Joi.object({
  name: Joi.string().min(2).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  role: Joi.string().valid("Admin", "Pharmacist").optional(),
  pharmacyId: Joi.string().min(2).required(),
  otp: Joi.string().trim().required()
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
  pharmacyId: Joi.string().optional()
});
