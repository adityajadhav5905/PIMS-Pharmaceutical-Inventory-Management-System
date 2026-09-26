import { Router } from "express";
import { login, logout, refresh, register, getProfile, updateProfile } from "../controllers/authController.js";
import { getPreferences, updatePreferences } from "../controllers/preferencesController.js";
import { validateBody } from "../middlewares/validate.js";
import { loginSchema, registerSchema } from "../validations/authValidation.js";
import { requireAuth } from "../middlewares/authMiddleware.js";

const router = Router();

router.post("/register", validateBody(registerSchema), register);
router.post("/login", validateBody(loginSchema), login);
router.post("/logout", logout);
router.post("/refresh", refresh);
router.get("/profile", requireAuth, getProfile);
router.put("/profile", requireAuth, updateProfile);
router.get("/preferences", requireAuth, getPreferences);
router.put("/preferences", requireAuth, updatePreferences);

export default router;
