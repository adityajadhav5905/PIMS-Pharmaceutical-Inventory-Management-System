import Joi from "joi";

export const medicineSchema = Joi.object({
  name: Joi.string().required(),
  sku: Joi.string().required(),
  brand: Joi.string().allow("").optional(),
  description: Joi.string().allow("").optional(),
  category: Joi.string().optional(),
  supplier: Joi.string().optional(),
  buyingPrice: Joi.number().min(0).default(0),
  sellingPrice: Joi.number().min(0).default(0),
  leadTimeDays: Joi.number().integer().min(1).default(7)
});

export const inventorySchema = Joi.object({
  medicine: Joi.string().optional(),
  name: Joi.string().optional(),
  brand: Joi.string().allow("").optional(),
  description: Joi.string().allow("").optional(),
  buyingPrice: Joi.number().min(0).optional(),
  sellingPrice: Joi.number().min(0).optional(),
  batchNumber: Joi.string().required(),
  currentStock: Joi.number().integer().min(0).required(),
  reorderLevel: Joi.number().integer().min(0).default(20),
  expiryDate: Joi.date().required()
}).or("medicine", "name");

export const inventoryUpdateSchema = Joi.object({
  medicine: Joi.string().optional(),
  name: Joi.string().optional(),
  brand: Joi.string().allow("").optional(),
  description: Joi.string().allow("").optional(),
  buyingPrice: Joi.number().min(0).optional(),
  sellingPrice: Joi.number().min(0).optional(),
  batchNumber: Joi.string().optional(),
  currentStock: Joi.number().integer().min(0).optional(),
  reorderLevel: Joi.number().integer().min(0).optional(),
  expiryDate: Joi.date().optional()
}).min(1);

export const sellSchema = Joi.object({
  inventoryId: Joi.string().required(),
  quantity: Joi.number().integer().min(1).required(),
  note: Joi.string().allow("").optional()
});

export const transactionSchema = Joi.object({
  medicine: Joi.string().required(),
  quantity: Joi.number().integer().min(1).required(),
  type: Joi.string().valid("IN", "OUT").required(),
  note: Joi.string().allow("").optional()
});

export const transactionUpdateSchema = Joi.object({
  medicine: Joi.string().optional(),
  quantity: Joi.number().integer().min(1).optional(),
  type: Joi.string().valid("IN", "OUT").optional(),
  note: Joi.string().allow("").optional()
}).min(1);
