import { Router } from "express";
import { login, refresh, register, getProfile, updateProfile } from "../controllers/authController.js";
import { validateBody } from "../middlewares/validate.js";
import { loginSchema, registerSchema } from "../validations/authValidation.js";
import { requireAuth } from "../middlewares/authMiddleware.js";

const router = Router();

router.post("/register", validateBody(registerSchema), register);
router.post("/login", validateBody(loginSchema), login);
router.post("/refresh", refresh);
router.get("/profile", requireAuth, getProfile);
router.put("/profile", requireAuth, updateProfile);

export default router;
