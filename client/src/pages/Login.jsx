import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Pill, AlertCircle, CheckCircle2, ShieldCheck, KeyRound, Clock, RefreshCw } from 'lucide-react';
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
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [timer, setTimer] = useState(0);

  const navigate = useNavigate();

  // OTP Countdown timer
  useEffect(() => {
    let interval;
    if (timer > 0) {
      interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handleSendOtp = async () => {
    if (!pharmacyId.trim() || !name.trim() || !email.trim() || !password) {
      setError('Please fill in Pharmacy ID, Name, Email, and Password first.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setError('');
    setOtpLoading(true);
    try {
      const res = await api.sendRegistrationOtp(email.trim(), pharmacyId.trim(), name.trim());
      setOtpSent(true);
      setTimer(300); // 5 minutes
      setSuccessMsg(res.message || `Verification code sent to ${email.trim()}.`);
    } catch (err) {
      setError(err.message || 'Failed to send verification code');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (isRegister && !otp.trim()) {
      setError('Please request and enter your 6-digit verification code.');
      return;
    }

    setLoading(true);

    try {
      if (isRegister) {
        // Register new tenant and admin account with verified OTP
        await api.register(name, email, password, pharmacyId, otp.trim());
        setSuccessMsg(`Pharmacy "${pharmacyId}" registered successfully! You can now log in.`);
        setIsRegister(false);
        setName('');
        setPharmacyId('');
        setOtp('');
        setOtpSent(false);
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 transition-colors duration-200 px-4 py-8">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-600 shadow-md">
              <Pill className="h-7 w-7 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">MedInventory</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            {isRegister ? 'Register a New Pharmacy Workspace' : 'Medical Inventory Management System'}
          </p>
        </div>

        {/* Form Container */}
        <div className="bg-white rounded-xl shadow-md p-8 dark:bg-gray-800 dark:border dark:border-gray-700">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3 dark:bg-red-950/20 dark:border-red-900/50 animate-in fade-in">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 dark:text-red-400 mt-0.5" />
              <p className="text-red-700 text-sm dark:text-red-400 leading-relaxed">{error}</p>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex gap-3 dark:bg-emerald-950/20 dark:border-emerald-900/50 animate-in fade-in">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 dark:text-emerald-400 mt-0.5" />
              <p className="text-emerald-700 text-sm dark:text-emerald-400 leading-relaxed">{successMsg}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Pharmacy Identifier (Slug) *
                  </label>
                  <input
                    type="text"
                    value={pharmacyId}
                    onChange={(e) => setPharmacyId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                    className="w-full px-3.5 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 font-mono text-sm"
                    placeholder="e.g. apollo-cure"
                    required
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Unique tenant identifier for your pharmacy workspace.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Admin Full Name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 text-sm"
                    placeholder="Dr. Aditya Jadhav"
                    required
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email Address *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 text-sm"
                placeholder="admin@hospital.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Password *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 text-sm"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-gray-500 dark:text-gray-400 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* OTP Section for Registration */}
            {isRegister && (
              <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-lg dark:bg-blue-950/30 dark:border-blue-900/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-blue-950 dark:text-blue-200 flex items-center gap-1.5">
                    <ShieldCheck size={16} className="text-blue-600 dark:text-blue-400" />
                    Email Verification Code *
                  </span>
                  {timer > 0 ? (
                    <span className="text-xs font-mono text-blue-700 dark:text-blue-300 flex items-center gap-1 font-semibold">
                      <Clock size={13} /> {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={otpLoading}
                      onClick={handleSendOtp}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 underline flex items-center gap-1"
                    >
                      {otpLoading ? <RefreshCw size={12} className="animate-spin" /> : null}
                      {otpSent ? 'Resend Code' : 'Send Verification Code'}
                    </button>
                  )}
                </div>

                <div>
                  <input
                    type="text"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter 6-digit verification code"
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-center tracking-widest font-mono text-lg font-bold shadow-sm"
                  />
                  <p className="text-xs text-blue-900/80 dark:text-blue-300/80 mt-1">
                    Enter the 6-digit code sent to your email address.
                  </p>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm text-sm font-semibold"
            >
              {loading ? (isRegister ? 'Creating Workspace...' : 'Logging in...') : (isRegister ? 'Verify & Create Pharmacy' : 'Login')}
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
                setOtp('');
                setOtpSent(false);
              }}
              className="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 transition-colors"
            >
              {isRegister ? 'Already registered? Login to your account' : 'Need a new workspace? Register a New Pharmacy'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
