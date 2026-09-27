import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, AlertCircle, TrendingUp, KeyRound, CheckCircle2, Copy, Check, ShieldCheck, Clock, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import { formatINR } from '../lib/format';
import Modal from '../components/Modal';

export default function Staff() {
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successInfo, setSuccessInfo] = useState(null);
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // OTP states
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [timer, setTimer] = useState(0);

  // Delete Modal with OTP state
  const [deleteModalStaff, setDeleteModalStaff] = useState(null);
  const [deleteOtp, setDeleteOtp] = useState('');
  const [deleteOtpSent, setDeleteOtpSent] = useState(false);
  const [deleteOtpLoading, setDeleteOtpLoading] = useState(false);
  const [deleteTimer, setDeleteTimer] = useState(0);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    position: 'Pharmacist',
    department: 'Dispensing',
    salary: '',
    phone: '',
    status: 'Active'
  });

  // Countdown timers
  useEffect(() => {
    let interval;
    if (timer > 0) {
      interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  useEffect(() => {
    let interval;
    if (deleteTimer > 0) {
      interval = setInterval(() => setDeleteTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [deleteTimer]);

  const loadStaff = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.getStaff(page, 10, search);
      setStaffList(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, [page, search]);

  const handleSendOtp = async (action = 'create') => {
    setError('');
    setOtpLoading(true);
    try {
      const res = await api.sendStaffOtp(action, formData.name);
      setOtpSent(true);
      setTimer(300); // 5 minutes
      setSuccessInfo({
        type: 'otp',
        message: res.message || 'Security verification code sent to your email.'
      });
    } catch (err) {
      setError(err.message || 'Failed to send security OTP');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleSendDeleteOtp = async () => {
    if (!deleteModalStaff) return;
    setError('');
    setDeleteOtpLoading(true);
    try {
      const res = await api.sendStaffOtp('delete', deleteModalStaff.name);
      setDeleteOtpSent(true);
      setDeleteTimer(300);
      setSuccessInfo({
        type: 'otp',
        message: res.message || 'Deletion verification code sent to your email.'
      });
    } catch (err) {
      setError(err.message || 'Failed to send delete OTP');
    } finally {
      setDeleteOtpLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload = { ...formData };
      if (!payload.password) delete payload.password;
      if (otp.trim()) payload.otp = otp.trim();

      if (editingId) {
        await api.updateStaff(editingId, payload);
        setSuccessInfo({
          type: 'update',
          message: `Staff details updated for ${formData.name}.`
        });
      } else {
        const assignedPassword = formData.password.trim() || 'ChangeMe123!';
        await api.createStaff(payload);
        setSuccessInfo({
          type: 'create',
          email: formData.email.trim(),
          password: assignedPassword,
          name: formData.name
        });
      }
      resetForm();
      loadStaff();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDelete = async (e) => {
    e.preventDefault();
    if (!deleteModalStaff) return;

    setLoading(true);
    setError('');
    try {
      await api.deleteStaff(deleteModalStaff._id, deleteOtp.trim());
      setSuccessInfo({
        type: 'delete',
        message: `Staff member ${deleteModalStaff.name} deleted successfully.`
      });
      setDeleteModalStaff(null);
      setDeleteOtp('');
      setDeleteOtpSent(false);
      loadStaff();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (staff) => {
    setFormData({
      name: staff.name,
      email: staff.email,
      password: '',
      position: staff.position,
      department: staff.department,
      salary: staff.salary,
      phone: staff.phone || '',
      status: staff.status
    });
    setEditingId(staff._id);
    setOtp('');
    setOtpSent(false);
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      position: 'Pharmacist',
      department: 'Dispensing',
      salary: '',
      phone: '',
      status: 'Active'
    });
    setEditingId(null);
    setOtp('');
    setOtpSent(false);
    setShowModal(false);
  };

  const handleCopyCredentials = () => {
    if (successInfo?.email && successInfo?.password) {
      navigator.clipboard.writeText(`Email: ${successInfo.email}\nPassword: ${successInfo.password}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Staff Management</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage pharmacy employees, credentials, and security authorizations.</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium"
        >
          <Plus size={20} /> Add Staff
        </button>
      </div>

      {/* Success Info Banner */}
      {successInfo && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl dark:bg-emerald-950/30 dark:border-emerald-900/60 flex items-start justify-between gap-4 animate-in fade-in">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <h4 className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                {successInfo.type === 'create'
                  ? 'Staff Account Provisioned & Welcome Email Sent'
                  : successInfo.type === 'otp'
                  ? 'Security OTP Dispatched'
                  : 'Action Completed Successfully'}
              </h4>
              {successInfo.type === 'create' ? (
                <div className="mt-1 text-xs text-emerald-800 dark:text-emerald-300 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span>Name: <strong>{successInfo.name}</strong></span>
                  <span>Login Email: <strong>{successInfo.email}</strong></span>
                  <span>Temporary Password: <code className="bg-emerald-100 dark:bg-emerald-900/50 px-1.5 py-0.5 rounded font-mono font-bold text-emerald-900 dark:text-emerald-200">{successInfo.password}</code></span>
                  <span className="text-emerald-600 dark:text-emerald-400">(Credentials also dispatched to employee's email)</span>
                </div>
              ) : (
                <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-300">{successInfo.message}</p>
              )}
            </div>
          </div>
          {successInfo.type === 'create' && (
            <button
              onClick={handleCopyCredentials}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition-colors shadow-sm"
              title="Copy credentials"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied!' : 'Copy Login'}
            </button>
          )}
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-lg shadow p-4 dark:bg-gray-800 dark:border dark:border-gray-700">
        <input
          type="text"
          placeholder="Search by name, email, or position..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 text-sm"
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3 dark:bg-red-950/20 dark:border-red-900/50">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 dark:text-red-400 mt-0.5" />
          <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <Modal
          title={editingId ? 'Edit Staff Member' : 'Add New Staff'}
          onClose={resetForm}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Email *</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Position *</label>
                <select
                  value={formData.position}
                  onChange={(e) => setFormData({...formData, position: e.target.value})}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  required
                >
                  <option value="Pharmacist">Pharmacist</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Department</label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) => setFormData({...formData, department: e.target.value})}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Salary (₹)</label>
                <input
                  type="number"
                  value={formData.salary}
                  onChange={(e) => setFormData({...formData, salary: e.target.value})}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {editingId ? 'Reset Password (Optional)' : 'Initial Password (Optional)'}
              </label>
              <input
                type="text"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                placeholder={editingId ? 'Leave blank to keep unchanged' : 'Leave blank for auto-generated secure password'}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 font-mono"
              />
            </div>

            {/* OTP Section for Staff Action */}
            <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-lg dark:bg-blue-950/30 dark:border-blue-900/60 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-950 dark:text-blue-200 flex items-center gap-1.5">
                  <ShieldCheck size={16} className="text-blue-600 dark:text-blue-400" />
                  Admin OTP Authorization *
                </span>
                {timer > 0 ? (
                  <span className="text-xs font-mono text-blue-700 dark:text-blue-300 flex items-center gap-1 font-semibold">
                    <Clock size={13} /> {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={otpLoading}
                    onClick={() => handleSendOtp(editingId ? 'update' : 'create')}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 underline flex items-center gap-1"
                  >
                    {otpLoading ? <RefreshCw size={12} className="animate-spin" /> : null}
                    {otpSent ? 'Resend Code' : 'Request Security Code'}
                  </button>
                )}
              </div>

              <div>
                <input
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter 6-digit Admin code"
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-center tracking-widest font-mono text-base font-bold shadow-sm"
                />
                <p className="text-xs text-blue-900/80 dark:text-blue-300/80 mt-1">
                  Code sent to current Admin account email.
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
              >
                {loading ? 'Saving...' : 'Save Staff'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Staff with OTP Confirmation Modal */}
      {deleteModalStaff && (
        <Modal
          title={`Delete Staff: ${deleteModalStaff.name}`}
          onClose={() => { setDeleteModalStaff(null); setDeleteOtp(''); setDeleteOtpSent(false); }}
        >
          <form onSubmit={handleConfirmDelete} className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              Are you sure you want to delete <strong>{deleteModalStaff.name}</strong> ({deleteModalStaff.email})? This action will permanently deactivate their login credentials.
            </p>

            <div className="p-3.5 bg-red-50/70 border border-red-200 rounded-lg dark:bg-red-950/20 dark:border-red-900/50 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-red-950 dark:text-red-200 flex items-center gap-1.5">
                  <ShieldCheck size={16} className="text-red-600 dark:text-red-400" />
                  Admin Deletion OTP *
                </span>
                {deleteTimer > 0 ? (
                  <span className="text-xs font-mono text-red-700 dark:text-red-300 flex items-center gap-1 font-semibold">
                    <Clock size={13} /> {Math.floor(deleteTimer / 60)}:{(deleteTimer % 60).toString().padStart(2, '0')}
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={deleteOtpLoading}
                    onClick={handleSendDeleteOtp}
                    className="text-xs font-semibold text-red-600 hover:text-red-700 dark:text-red-400 underline flex items-center gap-1"
                  >
                    {deleteOtpLoading ? <RefreshCw size={12} className="animate-spin" /> : null}
                    {deleteOtpSent ? 'Resend Code' : 'Send Deletion Code'}
                  </button>
                )}
              </div>

              <div>
                <input
                  type="text"
                  maxLength={6}
                  value={deleteOtp}
                  onChange={(e) => setDeleteOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter 6-digit Deletion code"
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-red-300 dark:border-red-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-center tracking-widest font-mono text-base font-bold shadow-sm"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setDeleteModalStaff(null); setDeleteOtp(''); }}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50 transition-colors text-sm font-medium"
              >
                {loading ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-x-auto dark:bg-gray-800 dark:border dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 dark:bg-gray-900 dark:border-gray-700">
            <tr>
              <th className="px-6 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Name</th>
              <th className="px-6 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Email</th>
              <th className="px-6 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Position</th>
              <th className="px-6 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Department</th>
              <th className="px-6 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Status</th>
              <th className="px-6 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Sales</th>
              <th className="px-6 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">Loading...</td></tr>
            ) : staffList.length === 0 ? (
              <tr><td colSpan="7" className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">No staff members found</td></tr>
            ) : (
              staffList.map((staff) => (
                <tr key={staff._id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">{staff.name}</td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{staff.email}</td>
                  <td className="px-6 py-4 dark:text-gray-300">{staff.position}</td>
                  <td className="px-6 py-4 dark:text-gray-300">{staff.department}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      staff.status === 'Active'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      {staff.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 dark:text-gray-200">
                      <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <span>{formatINR(staff.totalSales)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(staff)}
                        className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                        title="Edit staff member"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => setDeleteModalStaff(staff)}
                        className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        title="Delete staff member"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
