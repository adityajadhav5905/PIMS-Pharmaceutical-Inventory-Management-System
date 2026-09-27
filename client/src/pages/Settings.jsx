import { useState, useEffect } from 'react';
import { AlertCircle, Check, Eye, EyeOff, Save, ShieldCheck, Clock, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';

export default function Settings() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // OTP states
  const [nameOtp, setNameOtp] = useState('');
  const [nameOtpSent, setNameOtpSent] = useState(false);
  const [nameOtpLoading, setNameOtpLoading] = useState(false);
  const [nameTimer, setNameTimer] = useState(0);

  const [passwordOtp, setPasswordOtp] = useState('');
  const [passwordOtpSent, setPasswordOtpSent] = useState(false);
  const [passwordOtpLoading, setPasswordOtpLoading] = useState(false);
  const [passwordTimer, setPasswordTimer] = useState(0);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Countdown timers
  useEffect(() => {
    let interval;
    if (nameTimer > 0) {
      interval = setInterval(() => setNameTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [nameTimer]);

  useEffect(() => {
    let interval;
    if (passwordTimer > 0) {
      interval = setInterval(() => setPasswordTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [passwordTimer]);

  // Notification preferences state
  const [prefs, setPrefs] = useState({
    emailNotifications: true,
    inventoryAlerts: true,
    weeklyReports: false
  });
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [prefsSuccess, setPrefsSuccess] = useState('');
  const [prefsError, setPrefsError] = useState('');

  const loadProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.getProfile();
      setProfile(response.data);
      setFormData({
        name: response.data.name,
        email: response.data.email,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadPreferences = async () => {
    try {
      const response = await api.getPreferences();
      if (response.success && response.data) {
        setPrefs(response.data);
      }
    } catch (err) {
      console.error('Failed to load preferences:', err);
    }
  };

  useEffect(() => {
    loadProfile();
    loadPreferences();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSendNameOtp = async () => {
    setError('');
    setNameOtpLoading(true);
    try {
      const res = await api.sendSettingsOtp('CHANGE_NAME');
      setNameOtpSent(true);
      setNameTimer(300); // 5 minutes
      setSuccess(res.message || 'Name change verification code sent to your email.');
    } catch (err) {
      setError(err.message || 'Failed to send verification code for name change');
    } finally {
      setNameOtpLoading(false);
    }
  };

  const handleSendPasswordOtp = async () => {
    if (!formData.currentPassword || !formData.newPassword) {
      setError('Please enter your current password and new password before requesting verification code.');
      return;
    }
    if (formData.newPassword !== formData.confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    setError('');
    setPasswordOtpLoading(true);
    try {
      const res = await api.sendSettingsOtp('CHANGE_PASSWORD');
      setPasswordOtpSent(true);
      setPasswordTimer(300); // 5 minutes
      setSuccess(res.message || 'Password change verification code sent to your email.');
    } catch (err) {
      setError(err.message || 'Failed to send verification code for password change');
    } finally {
      setPasswordOtpLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const isChangingName = formData.name.trim() !== (profile?.name || '');
    const isChangingPassword = Boolean(formData.newPassword);

    if (isChangingPassword && formData.newPassword !== formData.confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const updateData = {
        name: formData.name,
        email: formData.email
      };

      if (isChangingName && nameOtp.trim()) {
        updateData.nameOtp = nameOtp.trim();
      }

      if (isChangingPassword) {
        updateData.currentPassword = formData.currentPassword;
        updateData.newPassword = formData.newPassword;
        if (passwordOtp.trim()) {
          updateData.passwordOtp = passwordOtp.trim();
        }
      }

      const response = await api.updateProfile(updateData);
      setProfile(response.data);
      setSuccess('Profile updated successfully!');
      setFormData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }));
      setNameOtp('');
      setNameOtpSent(false);
      setPasswordOtp('');
      setPasswordOtpSent(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrefChange = (key) => {
    setPrefs(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSavePreferences = async () => {
    setPrefsLoading(true);
    setPrefsError('');
    setPrefsSuccess('');
    try {
      await api.updatePreferences(prefs);
      setPrefsSuccess('Preferences saved successfully.');
    } catch (err) {
      setPrefsError(err.message || 'Failed to save preferences.');
    } finally {
      setPrefsLoading(false);
    }
  };

  if (!profile && !loading) {
    return <div className="text-center py-8 text-gray-600 dark:text-gray-400">Loading profile...</div>;
  }

  const isNameChanged = formData.name.trim() !== (profile?.name || '');

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
        <p className="text-gray-600 dark:text-gray-400">Manage account credentials, profile verification, and system preferences.</p>
      </div>

      {/* Profile Messages */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3 dark:bg-red-950/20 dark:border-red-900/50 animate-in fade-in">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5 dark:text-red-400" />
          <p className="text-red-700 dark:text-red-400 text-sm leading-relaxed">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex gap-3 dark:bg-emerald-950/20 dark:border-emerald-900/50 animate-in fade-in">
          <Check className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5 dark:text-emerald-400" />
          <p className="text-emerald-700 dark:text-emerald-400 text-sm leading-relaxed">{success}</p>
        </div>
      )}

      {/* Profile Section */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile Card */}
        <div className="bg-white rounded-xl shadow p-6 dark:bg-gray-800 dark:border dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 mb-4 dark:text-gray-100">Account Information</h2>
          {profile && (
            <div className="space-y-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-sm">
                {profile.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Full Name</p>
                <p className="text-base font-semibold text-gray-900 dark:text-gray-200">{profile.name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Email Address</p>
                <p className="text-base font-semibold text-gray-900 dark:text-gray-200">{profile.email}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Workspace Role</p>
                <p className="text-base font-semibold text-gray-900 capitalize dark:text-gray-200">{profile.role}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Pharmacy ID</p>
                <p className="text-base font-mono font-semibold text-blue-600 dark:text-blue-400">{profile.pharmacyId}</p>
              </div>
            </div>
          )}
        </div>

        {/* Edit Form */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow p-6 dark:bg-gray-800 dark:border dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 mb-4 dark:text-gray-100">Edit Profile & Security</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Full Name
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-3.5 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 text-sm"
                required
              />

              {/* Name OTP verification block if name changed */}
              {isNameChanged && (
                <div className="mt-3 p-3 bg-blue-50/70 border border-blue-200 rounded-lg dark:bg-blue-950/30 dark:border-blue-900/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-blue-950 dark:text-blue-200 flex items-center gap-1.5">
                      <ShieldCheck size={15} className="text-blue-600 dark:text-blue-400" />
                      Name Change Authorization OTP
                    </span>
                    {nameTimer > 0 ? (
                      <span className="text-xs font-mono text-blue-700 dark:text-blue-300 flex items-center gap-1">
                        <Clock size={12} /> {Math.floor(nameTimer / 60)}:{(nameTimer % 60).toString().padStart(2, '0')}
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={nameOtpLoading}
                        onClick={handleSendNameOtp}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 underline flex items-center gap-1"
                      >
                        {nameOtpLoading ? <RefreshCw size={12} className="animate-spin" /> : null}
                        {nameOtpSent ? 'Resend OTP' : 'Request Name Change OTP'}
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    maxLength={6}
                    value={nameOtp}
                    onChange={(e) => setNameOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter 6-digit verification code"
                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-center tracking-widest font-mono text-sm font-bold shadow-sm"
                  />
                </div>
              )}
            </div>

            {/* Email (Readonly for identity consistency) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email Address
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                disabled
                className="w-full px-3.5 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 dark:bg-gray-750 dark:border-gray-600 dark:text-gray-400 text-sm cursor-not-allowed"
              />
            </div>

            {/* Divider */}
            <div className="border-t border-gray-200 dark:border-gray-700 my-6 pt-6">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Change Password</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Leave blank if you don't want to change your password</p>
            </div>

            {/* Current Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Current Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="currentPassword"
                  value={formData.currentPassword}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 text-sm"
                  placeholder="Enter current password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2 text-gray-500 dark:text-gray-400"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  name="newPassword"
                  value={formData.newPassword}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 text-sm"
                  placeholder="Enter new password (min 8 characters)"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-2 text-gray-500 dark:text-gray-400"
                >
                  {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full px-3.5 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 text-sm"
                placeholder="Confirm new password"
              />
            </div>

            {/* Password Change OTP Section */}
            {formData.newPassword && (
              <div className="mt-3 p-3.5 bg-amber-50/80 border border-amber-200 rounded-lg dark:bg-amber-950/20 dark:border-amber-900/60 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
                    <ShieldCheck size={16} className="text-amber-600 dark:text-amber-400" />
                    Password Change Security OTP
                  </span>
                  {passwordTimer > 0 ? (
                    <span className="text-xs font-mono text-amber-700 dark:text-amber-300 flex items-center gap-1">
                      <Clock size={13} /> {Math.floor(passwordTimer / 60)}:{(passwordTimer % 60).toString().padStart(2, '0')}
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={passwordOtpLoading}
                      onClick={handleSendPasswordOtp}
                      className="text-xs font-semibold text-amber-700 hover:text-amber-800 dark:text-amber-400 underline flex items-center gap-1"
                    >
                      {passwordOtpLoading ? <RefreshCw size={12} className="animate-spin" /> : null}
                      {passwordOtpSent ? 'Resend OTP' : 'Request Password OTP'}
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  maxLength={6}
                  value={passwordOtp}
                  onChange={(e) => setPasswordOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter 6-digit verification code"
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-amber-300 dark:border-amber-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-center tracking-widest font-mono text-sm font-bold shadow-sm"
                />
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm text-sm"
            >
              {loading ? 'Saving Changes...' : 'Save Profile Changes'}
            </button>
          </form>
        </div>
      </div>

      {/* Additional Settings */}
      <div className="grid gap-6">
        {/* Preferences */}
        <div className="bg-white rounded-xl shadow p-6 dark:bg-gray-800 dark:border dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Notification Preferences</h2>

          {/* Feedback messages */}
          {prefsSuccess && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex gap-2 dark:bg-emerald-950/20 dark:border-emerald-900/50 animate-in fade-in">
              <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-emerald-700 dark:text-emerald-400">{prefsSuccess}</p>
            </div>
          )}
          {prefsError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2 dark:bg-red-950/20 dark:border-red-900/50 animate-in fade-in">
              <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5 dark:text-red-400" />
              <p className="text-sm text-red-700 dark:text-red-400">{prefsError}</p>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-200 text-sm">Email Notifications</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Receive email alerts for inventory and sales activity</p>
              </div>
              <input
                type="checkbox"
                checked={prefs.emailNotifications}
                onChange={() => handlePrefChange('emailNotifications')}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-200 text-sm">Inventory Alerts</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Get notified when medicine stock is low or nearing expiration</p>
              </div>
              <input
                type="checkbox"
                checked={prefs.inventoryAlerts}
                onChange={() => handlePrefChange('inventoryAlerts')}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-200 text-sm">Weekly Reports</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Receive weekly financial summary and stock turnover reports</p>
              </div>
              <input
                type="checkbox"
                checked={prefs.weeklyReports}
                onChange={() => handlePrefChange('weeklyReports')}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
              />
            </div>

            <button
              onClick={handleSavePreferences}
              disabled={prefsLoading}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
            >
              <Save size={16} />
              {prefsLoading ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
