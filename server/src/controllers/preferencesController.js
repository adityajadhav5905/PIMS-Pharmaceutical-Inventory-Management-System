import { asyncHandler } from "../utils/asyncHandler.js";
import { UserPreference } from "../models/index.js";

/**
 * GET /api/v1/auth/preferences
 * Return the current user's notification preferences.
 */
export const getPreferences = asyncHandler(async (req, res) => {
  const userId = req.user.sub;
  const prefs = await UserPreference.findByUserId(userId);

  if (!prefs) {
    return res.json({
      success: true,
      data: {
        emailNotifications: true,
        inventoryAlerts: true,
        weeklyReports: false
      }
    });
  }

  return res.json({
    success: true,
    data: {
      emailNotifications: Boolean(prefs.emailNotifications),
      inventoryAlerts: Boolean(prefs.inventoryAlerts),
      weeklyReports: Boolean(prefs.weeklyReports)
    }
  });
});

/**
 * PUT /api/v1/auth/preferences
 * Upsert the current user's notification preferences.
 */
export const updatePreferences = asyncHandler(async (req, res) => {
  const userId = req.user.sub;
  const { emailNotifications, inventoryAlerts, weeklyReports } = req.body;

  const current = await UserPreference.findByUserId(userId);

  const updated = await UserPreference.upsert(userId, {
    emailNotifications: emailNotifications !== undefined ? Boolean(emailNotifications) : (current ? current.emailNotifications : true),
    inventoryAlerts: inventoryAlerts !== undefined ? Boolean(inventoryAlerts) : (current ? current.inventoryAlerts : true),
    weeklyReports: weeklyReports !== undefined ? Boolean(weeklyReports) : (current ? current.weeklyReports : false)
  });

  return res.json({
    success: true,
    data: {
      emailNotifications: Boolean(updated.emailNotifications),
      inventoryAlerts: Boolean(updated.inventoryAlerts),
      weeklyReports: Boolean(updated.weeklyReports)
    }
  });
});
