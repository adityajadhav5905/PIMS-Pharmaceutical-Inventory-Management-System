import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, AlertCircle, TrendingUp } from 'lucide-react';
import { api } from '../lib/api';
import { formatINR } from '../lib/format';
import Modal from '../components/Modal';

export default function Staff() {
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    position: '',
    department: 'General',
    salary: '',
    phone: '',
    status: 'Active'
  });

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (editingId) {
        await api.updateStaff(editingId, formData);
      } else {
        await api.createStaff(formData);
      }
      resetForm();
      loadStaff();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this staff member?')) return;

    setLoading(true);
    setError('');
    try {
      await api.deleteStaff(id);
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
      position: staff.position,
      department: staff.department,
      salary: staff.salary,
      phone: staff.phone || '',
      status: staff.status
    });
    setEditingId(staff._id);
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      position: '',
      department: 'General',
      salary: '',
      phone: '',
      status: 'Active'
    });
    setEditingId(null);
    setShowModal(false);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Staff Management</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage staff members and monitor performance</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} /> Add Staff
        </button>
      </div>

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
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3 dark:bg-red-950/20 dark:border-red-900/50">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 dark:text-red-400" />
          <p className="text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <Modal
          title={editingId ? 'Edit Staff Member' : 'Add New Staff'}
          onClose={resetForm}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Position *</label>
                <select
                  value={formData.position}
                  onChange={(e) => setFormData({...formData, position: e.target.value})}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  required
                >
                  <option value="">Select position...</option>
                  <option value="Admin">Admin</option>
                  <option value="Employee">Employee</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Department</label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) => setFormData({...formData, department: e.target.value})}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Salary (₹)</label>
                <input
                  type="number"
                  value={formData.salary}
                  onChange={(e) => setFormData({...formData, salary: e.target.value})}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save'}
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
                <tr key={staff._id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
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
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(staff._id)}
                        className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
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
