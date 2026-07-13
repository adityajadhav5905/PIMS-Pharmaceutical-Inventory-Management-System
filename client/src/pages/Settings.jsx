import { useState, useEffect } from 'react';
import { AlertCircle, Check, Eye, EyeOff } from 'lucide-react';
import { api } from '../lib/api';

export default function Settings() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    loadProfile();
  }, []);

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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validate
    if (formData.newPassword !== formData.confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const updateData = {
        name: formData.name,
        email: formData.email
      };

      if (formData.newPassword) {
        updateData.currentPassword = formData.currentPassword;
        updateData.newPassword = formData.newPassword;
      }

      const response = await api.updateProfile(updateData);
      setProfile(response.data);
      setSuccess('Profile updated successfully');
      setFormData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!profile && !loading) {
    return <div className="text-center py-8 text-gray-600">Loading profile...</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
        <p className="text-gray-600 dark:text-gray-400">Manage your account settings and preferences</p>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3 dark:bg-red-950/20 dark:border-red-900/50">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5 dark:text-red-400" />
          <p className="text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex gap-3 dark:bg-green-950/20 dark:border-green-900/50">
          <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5 dark:text-green-400" />
          <p className="text-green-700 dark:text-green-400">{success}</p>
        </div>
      )}

      {/* Profile Section */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile Card */}
        <div className="bg-white rounded-lg shadow p-6 dark:bg-gray-800 dark:border dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 mb-4 dark:text-gray-100">Account Information</h2>
          {profile && (
            <div className="space-y-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                {profile.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Name</p>
                <p className="text-lg font-medium text-gray-900 dark:text-gray-200">{profile.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Email</p>
                <p className="text-lg font-medium text-gray-900 dark:text-gray-200">{profile.email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Role</p>
                <p className="text-lg font-medium text-gray-900 capitalize dark:text-gray-200">{profile.role}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Member Since</p>
                <p className="text-lg font-medium text-gray-900 dark:text-gray-200">
                  {new Date(profile.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Edit Profile Form */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow p-6 dark:bg-gray-800 dark:border dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 mb-4 dark:text-gray-100">Edit Profile</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Full Name
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                required
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email Address
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                required
              />
            </div>

            {/* Divider */}
            <div className="border-t border-gray-200 dark:border-gray-700 my-6 pt-6">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Change Password</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Leave blank if you don't want to change your password</p>
            </div>

            {/* Current Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Current Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="currentPassword"
                  value={formData.currentPassword}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                  placeholder="Enter current password to change password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-gray-500"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  name="newPassword"
                  value={formData.newPassword}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                  placeholder="Enter new password (optional)"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-2.5 text-gray-500"
                >
                  {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Confirm New Password
              </label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                placeholder="Confirm new password"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>
      </div>

      {/* Additional Settings */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Preferences */}
        <div className="bg-white rounded-lg shadow p-6 dark:bg-gray-800 dark:border dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Preferences</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-gray-700 dark:text-gray-300">Email Notifications</label>
              <input type="checkbox" defaultChecked className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600" />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-gray-700 dark:text-gray-300">Inventory Alerts</label>
              <input type="checkbox" defaultChecked className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600" />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-gray-700 dark:text-gray-300">Weekly Reports</label>
              <input type="checkbox" className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600" />
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="bg-white rounded-lg shadow p-6 dark:bg-gray-800 dark:border dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Security</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-200">Two-Factor Authentication</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Not enabled</p>
              </div>
              <button className="px-4 py-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium">
                Enable
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
