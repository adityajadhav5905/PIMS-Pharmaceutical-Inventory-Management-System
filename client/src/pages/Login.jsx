import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Pill, AlertCircle, CheckCircle2 } from 'lucide-react';
import { api } from '../lib/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  // Registration specific states
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [pharmacyId, setPharmacyId] = useState('');

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (isRegister) {
        // Register new tenant and admin account
        await api.register(name, email, password, pharmacyId);
        setSuccessMsg(`Pharmacy "${pharmacyId}" registered successfully! You can now log in.`);
        setIsRegister(false);
        setName('');
        setPharmacyId('');
      } else {
        // Log in existing user
        const response = await api.login(email, password);
        localStorage.setItem('token', response.data.accessToken);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message || (isRegister ? 'Registration failed' : 'Login failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 transition-colors duration-200 px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-600">
              <Pill className="h-7 w-7 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">MedInventory</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            {isRegister ? 'Register a New Pharmacy Workspace' : 'Medical Inventory Management System'}
          </p>
        </div>

        {/* Form Container */}
        <div className="bg-white rounded-lg shadow-md p-8 dark:bg-gray-800 dark:border dark:border-gray-700">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3 dark:bg-red-950/20 dark:border-red-900/50">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 dark:text-red-400" />
              <p className="text-red-700 text-sm dark:text-red-400">{error}</p>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex gap-3 dark:bg-green-950/20 dark:border-green-900/50">
              <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 dark:text-green-400" />
              <p className="text-green-700 text-sm dark:text-green-400">{successMsg}</p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {isRegister && (
              <>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Pharmacy Identifier (Slug)
                  </label>
                  <input
                    type="text"
                    value={pharmacyId}
                    onChange={(e) => setPharmacyId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 font-mono"
                    placeholder="e.g. apollo-pharmacy"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">This will be your unique pharmacy tenant key.</p>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Admin Full Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                    placeholder="Dr. John Doe"
                    required
                  />
                </div>
              </>
            )}

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                placeholder="admin@hospital.com"
                required
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-gray-500 dark:text-gray-400"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? (isRegister ? 'Registering...' : 'Logging in...') : (isRegister ? 'Register Pharmacy' : 'Login')}
            </button>
          </form>

          {/* Toggle Link */}
          <div className="mt-6 text-center border-t border-gray-100 dark:border-gray-700 pt-4">
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister);
                setError('');
                setSuccessMsg('');
              }}
              className="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 transition-colors"
            >
              {isRegister ? 'Already registered? Login to your account' : 'Need a new workspace? Register a New Pharmacy'}
            </button>
          </div>
        </div>

        {/* Demo credentials (only visible in login mode) */}
        {!isRegister && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-950/20 dark:border-blue-900">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Quick Demo Accounts (Click to Fill):</p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <button
                type="button"
                onClick={() => {
                  setEmail('admin@hospital.com');
                  setPassword('ChangeMe123!');
                }}
                className="p-2 text-left bg-white dark:bg-gray-800 rounded border border-blue-200 dark:border-blue-900 hover:border-blue-500 transition-colors"
              >
                <p className="font-semibold text-blue-700 dark:text-blue-400">System Admin</p>
                <p className="text-gray-500 dark:text-gray-400 truncate">admin@hospital.com</p>
                <p className="text-gray-400 dark:text-gray-500">Pass: ChangeMe123!</p>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail('jane@hospital.com');
                  setPassword('ChangeMe123!');
                }}
                className="p-2 text-left bg-white dark:bg-gray-800 rounded border border-blue-200 dark:border-blue-900 hover:border-blue-500 transition-colors"
              >
                <p className="font-semibold text-green-700 dark:text-green-400">Pharmacist</p>
                <p className="text-gray-500 dark:text-gray-400 truncate">jane@hospital.com</p>
                <p className="text-gray-400 dark:text-gray-500">Pass: ChangeMe123!</p>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
