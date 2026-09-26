import Joi from "joi";

const idSchema = Joi.alternatives().try(Joi.number().integer(), Joi.string());

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
  medicine: idSchema.optional(),
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
  medicine: idSchema.optional(),
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
  inventoryId: idSchema.required(),
  quantity: Joi.number().integer().min(1).required(),
  note: Joi.string().allow("").optional(),
  employeeId: idSchema.optional()
});

export const transactionSchema = Joi.object({
  medicine: idSchema.optional(),
  medicineId: idSchema.optional(),
  inventoryId: idSchema.optional(),
  quantity: Joi.number().integer().min(1).required(),
  type: Joi.string().valid("IN", "OUT").required(),
  unitBuyPrice: Joi.number().min(0).optional(),
  unitSellPrice: Joi.number().min(0).optional(),
  employeeId: idSchema.optional(),
  note: Joi.string().allow("").optional()
}).or("medicine", "medicineId");

export const transactionUpdateSchema = Joi.object({
  medicine: idSchema.optional(),
  medicineId: idSchema.optional(),
  inventoryId: idSchema.optional(),
  quantity: Joi.number().integer().min(1).optional(),
  type: Joi.string().valid("IN", "OUT").optional(),
  unitBuyPrice: Joi.number().min(0).optional(),
  unitSellPrice: Joi.number().min(0).optional(),
  employeeId: idSchema.optional(),
  note: Joi.string().allow("").optional()
}).min(1);
