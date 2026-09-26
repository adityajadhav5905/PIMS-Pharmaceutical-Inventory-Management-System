import { asyncHandler } from "../utils/asyncHandler.js";
import { UserPreference } from "../models/index.js";

/**
 * GET /api/v1/auth/preferences
 * Return the current user's notification preferences.
 */
export const getPreferences = asyncHandler(async (req, res) => {
  const userId = req.user.sub;
  const prefs = await UserPreference.findOne({ userId });

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

  const prefs = await UserPreference.findOneAndUpdate(
    { userId },
    {
      emailNotifications: emailNotifications !== undefined ? Boolean(emailNotifications) : true,
      inventoryAlerts: inventoryAlerts !== undefined ? Boolean(inventoryAlerts) : true,
      weeklyReports: weeklyReports !== undefined ? Boolean(weeklyReports) : false
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return res.json({
    success: true,
    data: {
      emailNotifications: Boolean(prefs.emailNotifications),
      inventoryAlerts: Boolean(prefs.inventoryAlerts),
      weeklyReports: Boolean(prefs.weeklyReports)
    }
  });
});
