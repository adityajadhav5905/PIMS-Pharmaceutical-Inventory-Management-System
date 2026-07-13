import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Pill, AlertCircle } from 'lucide-react';
import { api } from '../lib/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.login(email, password);
      localStorage.setItem('token', response.data.accessToken);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-600">
              <Pill className="h-7 w-7 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">MedInventory</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Medical Inventory Management System</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-8 dark:bg-gray-800 dark:border dark:border-gray-700">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3 dark:bg-red-950/20 dark:border-red-900/50">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 dark:text-red-400" />
              <p className="text-red-700 text-sm dark:text-red-400">{error}</p>
            </div>
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
              placeholder="you@example.com"
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
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        {/* Demo credentials */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-950/20 dark:border-blue-900">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Demo Credentials:</p>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="font-medium text-blue-800 dark:text-blue-400">System Admin role:</p>
              <p className="text-gray-650 dark:text-gray-400">U: admin@hospital.com</p>
              <p className="text-gray-650 dark:text-gray-400">P: ChangeMe123!</p>
            </div>
            <div>
              <p className="font-medium text-blue-800 dark:text-blue-400">Employee role:</p>
              <p className="text-gray-650 dark:text-gray-400">U: pharmacist@hospital.com</p>
              <p className="text-gray-650 dark:text-gray-400">P: ChangeMe123!</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
