import { useState } from 'react';
import { Download, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react';
import { api } from '../lib/api';

/** CSV export page — download all transactions and current stock. */
export default function ExportData() {
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleDownload = async (type) => {
    setError('');
    setSuccess('');
    setLoading(type);

    try {
      if (type === 'transactions') {
        await api.downloadTransactionsCsv();
        setSuccess('All transactions downloaded as CSV.');
      } else {
        await api.downloadStockCsv();
        setSuccess('Current stock downloaded as CSV.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading('');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Export Data</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Download inventory records as CSV files for offline analysis.
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

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
          <FileSpreadsheet className="mb-3 h-10 w-10 text-blue-600" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            All Transactions
          </h3>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Every stock IN/OUT entry with quantities, prices, and profit in INR.
          </p>
          <button
            onClick={() => handleDownload('transactions')}
            disabled={loading === 'transactions'}
            className="mt-4 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Download size={18} />
            {loading === 'transactions' ? 'Downloading...' : 'Download CSV'}
          </button>
        </div>

        <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
          <FileSpreadsheet className="mb-3 h-10 w-10 text-green-600" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Current Stock</h3>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Snapshot of all batches with stock levels, expiry dates, and pricing in INR.
          </p>
          <button
            onClick={() => handleDownload('stock')}
            disabled={loading === 'stock'}
            className="mt-4 flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-50"
          >
            <Download size={18} />
            {loading === 'stock' ? 'Downloading...' : 'Download CSV'}
          </button>
        </div>
      </div>
    </div>
  );
}
