import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Trash2, Edit2, AlertCircle } from 'lucide-react';
import { api } from '../lib/api';
import { formatDate, formatINR } from '../lib/format';
import Modal from '../components/Modal';

const emptyForm = {
  name: '',
  brand: '',
  description: '',
  buyingPrice: '',
  sellingPrice: '',
  batchNumber: '',
  currentStock: '',
  newStock: '',
  reorderLevel: '20',
  expiryDate: '',
};

/** Inventory management — add/edit batches with medicine details and INR pricing. */
export default function Inventory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') || '';

  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState(initialSearch);
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(emptyForm);

  // States for matching medicines autocomplete and preloading current stock
  const [medicines, setMedicines] = useState([]);
  const [availableStock, setAvailableStock] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [isExistingMedicine, setIsExistingMedicine] = useState(false);

  const loadInventory = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.getInventory(page, 10, search);
      setInventory(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch medicines catalog and all active inventory batches to compute stock preloads
  const loadMedicinesAndStock = async () => {
    try {
      const [medsRes, stockRes] = await Promise.all([
        api.getMedicines(),
        api.getAvailableStock()
      ]);
      setMedicines(medsRes.data || []);
      setAvailableStock(stockRes.data || []);
    } catch (err) {
      console.error('Failed to load autocomplete items:', err);
    }
  };

  useEffect(() => {
    loadInventory();
    loadMedicinesAndStock();
  }, [page, search]);

  /**
   * Pre-populates medicine metadata (brand, description, prices) and aggregates
   * its total current stock across all active batches.
   */
  const handleSelectMedicine = (medicine) => {
    // Sum stock of this medicine across all batches
    const totalStock = availableStock
      .filter((item) => item.medicine?._id === medicine._id)
      .reduce((sum, item) => sum + (item.currentStock || 0), 0);

    setFormData({
      ...formData,
      name: medicine.name,
      brand: medicine.brand || '',
      description: medicine.description || '',
      buyingPrice: medicine.buyingPrice ?? '',
      sellingPrice: medicine.sellingPrice ?? '',
      currentStock: totalStock, // Preload current total stock count
      newStock: '',
    });
    setIsExistingMedicine(true); // selected an already present medicine
    setSuggestions([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const payload = {
      ...formData,
      buyingPrice: Number(formData.buyingPrice) || 0,
      sellingPrice: Number(formData.sellingPrice) || 0,
      currentStock: (isExistingMedicine && !editingId)
        ? Number(formData.newStock)
        : Number(formData.currentStock),
      reorderLevel: Number(formData.reorderLevel) || 20,
    };
    delete payload.newStock;

    try {
      if (editingId) {
        await api.updateInventory(editingId, payload);
      } else {
        await api.createInventory(payload);
      }
      resetForm();
      loadInventory();
      loadMedicinesAndStock(); // Refresh catalog and stock for autocomplete updates
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this batch?')) return;
    setLoading(true);
    try {
      await api.deleteInventory(id);
      loadInventory();
      loadMedicinesAndStock();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item) => {
    setFormData({
      name: item.medicine?.name || '',
      brand: item.medicine?.brand || '',
      description: item.medicine?.description || '',
      buyingPrice: item.medicine?.buyingPrice ?? '',
      sellingPrice: item.medicine?.sellingPrice ?? '',
      batchNumber: item.batchNumber,
      currentStock: item.currentStock,
      newStock: '',
      reorderLevel: item.reorderLevel,
      expiryDate: item.expiryDate?.split('T')[0] || '',
    });
    setEditingId(item._id);
    setIsExistingMedicine(false);
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setEditingId(null);
    setShowModal(false);
    setSuggestions([]);
    setIsExistingMedicine(false);
  };

  const inputClass =
    'w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Medicine Inventory</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Add stock with drug name, brand, description, and INR pricing.
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          <Plus size={20} /> Add Stock
        </button>
      </div>

      <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
        <input
          type="text"
          placeholder="Search by medicine or brand..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className={inputClass}
        />
      </div>

      {error && (
        <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {showModal && (
        <Modal
          title={editingId ? 'Edit Stock Batch' : 'Add New Stock'}
          onClose={resetForm}
          wide
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Drug Name *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData({ ...formData, name: val });
                      setIsExistingMedicine(false); // Reset preloaded flags if they type manually
                      if (!val.trim()) {
                        setSuggestions([]);
                      } else {
                        const filtered = medicines.filter((m) =>
                          m.name.toLowerCase().includes(val.toLowerCase())
                        );
                        setSuggestions(filtered);
                      }
                    }}
                    onFocus={() => {
                      if (formData.name) {
                        const filtered = medicines.filter((m) =>
                          m.name.toLowerCase().includes(formData.name.toLowerCase())
                        );
                        setSuggestions(filtered);
                      }
                    }}
                    onBlur={() => {
                      // Slight delay to allow clicked suggestion to register first
                      setTimeout(() => setSuggestions([]), 200);
                    }}
                    className={inputClass}
                    required
                    disabled={!!editingId}
                    placeholder="Search or type medicine name..."
                    autoComplete="off"
                  />
                  {suggestions.length > 0 && (
                    <ul className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700 rounded-lg shadow-lg">
                      {suggestions.map((m) => (
                        <li
                          key={m._id}
                          onMouseDown={() => handleSelectMedicine(m)}
                          className="px-4 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer text-gray-900 dark:text-gray-100 border-b border-gray-100 dark:border-gray-700 text-sm"
                        >
                          <span className="font-semibold">{m.name}</span> {m.brand ? `(${m.brand})` : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Brand
                </label>
                <input
                  type="text"
                  value={formData.brand}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Description
              </label>
              <textarea
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className={inputClass}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Buying Price (₹) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.buyingPrice}
                  onChange={(e) => setFormData({ ...formData, buyingPrice: e.target.value })}
                  className={inputClass}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Selling Price (₹) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.sellingPrice}
                  onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                  className={inputClass}
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Batch Number *
                </label>
                <input
                  type="text"
                  value={formData.batchNumber}
                  onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
                  className={inputClass}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Current Stock *
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.currentStock}
                  onChange={(e) => setFormData({ ...formData, currentStock: e.target.value })}
                  className={inputClass}
                  required
                  disabled={isExistingMedicine && !editingId}
                />
              </div>
            </div>

            {isExistingMedicine && !editingId && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  New Stock (Amount to add) *
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.newStock}
                  onChange={(e) => setFormData({ ...formData, newStock: e.target.value })}
                  placeholder="Enter quantity of new stock to add"
                  className={inputClass}
                  required
                />
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Reorder Level
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.reorderLevel}
                  onChange={(e) => setFormData({ ...formData, reorderLevel: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Expiry Date *
                </label>
                <input
                  type="date"
                  value={formData.expiryDate}
                  onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                  className={inputClass}
                  required
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
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

      <div className="overflow-x-auto rounded-lg bg-white shadow dark:bg-gray-800">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Medicine</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Brand</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Batch</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Stock</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Buy/Sell</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Expiry</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" className="px-4 py-4 text-center text-gray-500">Loading...</td></tr>
            ) : inventory.length === 0 ? (
              <tr><td colSpan="7" className="px-4 py-4 text-center text-gray-500">No inventory found</td></tr>
            ) : (
              inventory.map((item) => (
                <tr key={item._id} className="border-b border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{item.medicine?.name || 'N/A'}</td>
                  <td className="px-4 py-3">{item.medicine?.brand || '—'}</td>
                  <td className="px-4 py-3">{item.batchNumber}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                      item.currentStock <= item.reorderLevel
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    }`}>
                      {item.currentStock}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {formatINR(item.medicine?.buyingPrice)} / {formatINR(item.medicine?.sellingPrice)}
                  </td>
                  <td className="px-4 py-3">{formatDate(item.expiryDate)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => handleEdit(item)} className="text-blue-600 hover:text-blue-700">
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => handleDelete(item._id)} className="text-red-600 hover:text-red-700">
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
