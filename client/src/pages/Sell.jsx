import { useState, useEffect } from 'react';
import { ShoppingCart, AlertCircle, CheckCircle2 } from 'lucide-react';
import { api } from '../lib/api';
import { formatDate, formatINR } from '../lib/format';

/** Sell / exit stock — deducts quantity and records profit. */
export default function Sell() {
  const [stock, setStock] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({ inventoryId: '', quantity: '', note: '', employeeId: '' });
  const [isAdmin, setIsAdmin] = useState(false);

  // Autocomplete search states
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const loadStock = async () => {
    setLoading(true);
    try {
      const res = await api.getAvailableStock();
      setStock(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadEmployees = async () => {
    try {
      const res = await api.getStaffSales();
      setEmployees(res.data);
      
      const loggedInUserStr = localStorage.getItem('user');
      if (loggedInUserStr) {
        const loggedInUser = JSON.parse(loggedInUserStr);
        setIsAdmin(loggedInUser.role === 'Admin');
        const matched = res.data.find(e => e.email === loggedInUser.email);
        if (matched) {
          setForm(prev => ({ ...prev, employeeId: matched._id }));
        }
      }
    } catch (err) {
      console.error("Failed to load active employee list:", err);
    }
  };

  useEffect(() => {
    loadStock();
    loadEmployees();
  }, []);

  const selected = stock.find((s) => s._id === form.inventoryId);
  const qty = Number(form.quantity) || 0;
  const estimatedProfit = selected
    ? qty * ((selected.medicine?.sellingPrice || 0) - (selected.medicine?.buyingPrice || 0))
    : 0;
  const estimatedRevenue = selected ? qty * (selected.medicine?.sellingPrice || 0) : 0;

  const resetForm = () => {
    setForm(prev => ({ ...prev, inventoryId: '', quantity: '', note: '' }));
    setSearchTerm('');
    setShowDropdown(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Pre-check quantity constraints to prevent selling more than available
    if (selected && Number(form.quantity) > selected.currentStock) {
      const errMsg = `Cannot sell more than available stock! Selected batch has only ${selected.currentStock} units.`;
      setError(errMsg);
      window.alert(`Error: ${errMsg}`);
      return;
    }

    setLoading(true);

    try {
      const res = await api.sellStock({
        inventoryId: form.inventoryId,
        quantity: Number(form.quantity),
        note: form.note,
        employeeId: form.employeeId,
      });
      setSuccess(
        `Sale recorded! Profit: ${formatINR(res.data.profit)} · Remaining stock: ${res.data.remainingStock}`
      );
      resetForm();
      loadStock();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Sell Stock</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Record a sale to exit inventory and update stock automatically.
        </p>
      </div>

      {error && (
        <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
          <p className="text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {success && (
        <div className="flex gap-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
          <p className="text-green-700 dark:text-green-400">{success}</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <form
          onSubmit={handleSubmit}
          className="rounded-lg bg-white p-6 shadow dark:bg-gray-800"
        >
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-gray-100">
            <ShoppingCart className="h-5 w-5" /> New Sale
          </h2>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Select Batch (Type to search) *
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Type medicine name, brand, or batch..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => {
                    // Slight delay to allow clicked suggestion to register first
                    setTimeout(() => setShowDropdown(false), 200);
                  }}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  required={!form.inventoryId}
                  autoComplete="off"
                />
                {showDropdown && (
                  <ul className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700 rounded-lg shadow-lg">
                    {stock
                      .filter((item) => {
                        const search = searchTerm.toLowerCase();
                        return (
                          (item.medicine?.name || '').toLowerCase().includes(search) ||
                          (item.medicine?.brand || '').toLowerCase().includes(search) ||
                          (item.batchNumber || '').toLowerCase().includes(search)
                        );
                      })
                      .map((item) => (
                        <li
                          key={item._id}
                          onMouseDown={() => {
                            setForm({ ...form, inventoryId: item._id });
                            setSearchTerm(
                              `${item.medicine?.name} (${item.medicine?.brand || 'No brand'}) — Batch ${item.batchNumber}`
                            );
                            setShowDropdown(false);
                          }}
                          className="px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer border-b border-gray-100 dark:border-gray-700 text-sm"
                        >
                          <div className="font-semibold text-gray-900 dark:text-gray-100">
                            {item.medicine?.name} {item.medicine?.brand ? `(${item.medicine?.brand})` : ''}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            Batch: <span className="font-mono">{item.batchNumber}</span> · Stock: <span className="font-bold text-blue-600 dark:text-blue-400">{item.currentStock} units</span> · Exp: {formatDate(item.expiryDate)} · Price: {formatINR(item.medicine?.sellingPrice)}/unit
                          </div>
                        </li>
                      ))}
                    {stock.filter((item) => {
                      const search = searchTerm.toLowerCase();
                      return (
                        (item.medicine?.name || '').toLowerCase().includes(search) ||
                        (item.medicine?.brand || '').toLowerCase().includes(search) ||
                        (item.batchNumber || '').toLowerCase().includes(search)
                      );
                    }).length === 0 && (
                      <li className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                        No matching available stock batches found
                      </li>
                    )}
                  </ul>
                )}
              </div>
            </div>

            {isAdmin && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Dispensed By (Employee) *
                </label>
                <select
                  value={form.employeeId}
                  onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  required
                >
                  <option value="">Select dispensing employee...</option>
                  {employees.map((emp) => (
                    <option key={emp._id} value={emp._id}>
                      {emp.name} ({emp.position} · {emp.department})
                    </option>
                  ))}
                  {employees.length === 0 && (
                    <option disabled value="">No active employees found. Please add staff first.</option>
                  )}
                </select>
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Quantity to Sell
              </label>
              <input
                type="number"
                min="1"
                max={selected?.currentStock || undefined}
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                required
              />
              {selected && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Available: {selected.currentStock} units
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Note (optional)
              </label>
              <input
                type="text"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="Customer / prescription ref"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
            </div>

            {selected && qty > 0 && (
              <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Sell price: {formatINR(selected.medicine?.sellingPrice)}/unit
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Revenue: {formatINR(estimatedRevenue)}
                </p>
                <p className="mt-1 font-semibold text-green-700 dark:text-green-400">
                  Estimated profit: {formatINR(estimatedProfit)}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !form.inventoryId}
              className="w-full rounded-lg bg-blue-600 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Confirm Sale'}
            </button>
          </div>
        </form>

        {/* Available stock list */}
        <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
          <h2 className="mb-4 text-lg font-bold text-gray-900 dark:text-gray-100">
            Available Stock
          </h2>
          {stock.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No stock available to sell.</p>
          ) : (
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {stock.map((item) => (
                <div
                  key={item._id}
                  className="rounded-lg border border-gray-200 p-3 dark:border-gray-700"
                >
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {item.medicine?.name}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {item.medicine?.brand} · Batch {item.batchNumber}
                  </p>
                  <div className="mt-1 flex justify-between text-sm">
                    <span>{item.currentStock} units</span>
                    <span>{formatINR(item.medicine?.sellingPrice)}/unit</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
