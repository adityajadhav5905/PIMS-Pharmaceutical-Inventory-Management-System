import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Check, Send, LifeBuoy } from 'lucide-react';
import { api } from '../lib/api';

// Map documentation topic slugs to internal app routes
const DOC_LINKS = [
  { label: 'Getting Started', route: '/dashboard', desc: 'Overview of the PIMS dashboard' },
  { label: 'Inventory Management', route: '/inventory', desc: 'Add, update, and remove inventory batches' },
  { label: 'Alert System', route: '/alerts', desc: 'View and manage stock & expiry alerts' },
  { label: 'Staff Management', route: '/staff', desc: 'Manage pharmacist and staff accounts' },
  { label: 'Financial Reports', route: '/financials', desc: 'View revenue, costs, and profit summaries' },
  { label: 'CSV Export', route: '/export', desc: 'Download transactions and stock data' },
];

export default function Help() {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [user, setUser] = useState(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) setUser(JSON.parse(stored));
    } catch {
      // Ignore
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!subject.trim() || !message.trim()) {
      setError('Please fill in both Subject and Message fields.');
      return;
    }

    setLoading(true);
    try {
      await api.submitSupportTicket({ subject: subject.trim(), message: message.trim() });
      setSuccess('Your support ticket has been submitted. We will get back to you shortly.');
      setSubject('');
      setMessage('');
    } catch (err) {
      setError(err.message || 'Failed to submit ticket. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Help & Support</h1>
          <p className="text-gray-600 dark:text-gray-400">Find answers and get support</p>
        </div>
        {user?.role === 'Admin' && (
          <Link
            to="/support-tickets"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
          >
            <LifeBuoy className="h-4 w-4" />
            Admin Ticket Desk →
          </Link>
        )}
      </div>

      {user?.role === 'Admin' && (
        <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50/70 p-4 shadow-sm dark:border-blue-900/50 dark:bg-blue-950/20">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white">
              <LifeBuoy className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                Administrator Support Desk
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                You have admin privileges. View, track, and update all user inquiries and issue reports.
              </p>
            </div>
          </div>
          <Link
            to="/support-tickets"
            className="hidden text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400 sm:inline"
          >
            Manage Support Tickets →
          </Link>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* FAQ */}
        <div className="bg-white rounded-lg shadow p-6 dark:bg-gray-800 dark:border dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 mb-4 dark:text-gray-100">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {[
              { q: 'How to add new medicine?', a: 'Go to the Inventory page and click "Add Medicine" button to create a new medicine batch.' },
              { q: 'How to check alerts?', a: 'Navigate to the Alerts page to view all active low-stock, overstock, and expiry alerts.' },
              { q: 'How to add staff?', a: 'Use the Staff page and click "Add Staff" to add new team members.' },
              { q: 'How to record a sale?', a: 'Go to the Sell Stock page, select a batch and quantity, then submit.' },
              { q: 'How to export data?', a: 'Use the Export Data page to download transactions, stock levels, or staff performance as CSV.' },
              { q: 'How does Demand Forecasting work?', a: 'Visit the Demand Forecasting page, select a medicine, choose a forecast period (7–90 days), and click Calculate Forecast. The system computes predicted demand using category seasonal factors and historical sales baselines.' },
            ].map((item, idx) => (
              <details key={idx} className="border border-gray-200 rounded-lg p-4 dark:border-gray-700">
                <summary className="font-medium text-gray-900 cursor-pointer dark:text-gray-200">{item.q}</summary>
                <p className="text-gray-600 mt-2 text-sm dark:text-gray-400">{item.a}</p>
              </details>
            ))}
          </div>
        </div>

        {/* Contact Support */}
        <div className="bg-white rounded-lg shadow p-6 dark:bg-gray-800 dark:border dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 mb-4 dark:text-gray-100">Contact Support</h2>

          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex gap-2 dark:bg-green-950/20 dark:border-green-900/50">
              <Check className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-700 dark:text-green-400">{success}</p>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2 dark:bg-red-950/20 dark:border-red-900/50">
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                Subject <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="How can we help?"
                minLength={3}
                maxLength={255}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                Message <span className="text-red-500">*</span>
              </label>
              <textarea
                rows="5"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe your issue in detail..."
                minLength={10}
                maxLength={5000}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              />
              <p className="text-xs text-gray-400 mt-1 text-right">{message.length}/5000</p>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 dark:hover:bg-blue-500 disabled:opacity-50 transition-colors"
            >
              <Send size={16} />
              {loading ? 'Submitting...' : 'Send Message'}
            </button>
          </form>
        </div>
      </div>

      {/* Documentation links - now pointing to actual app routes */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 dark:bg-blue-950/20 dark:border-blue-900">
        <h2 className="text-lg font-bold text-gray-900 mb-4 dark:text-gray-100">Quick Navigation</h2>
        <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {DOC_LINKS.map((doc) => (
            <li key={doc.label}>
              <a
                href={doc.route}
                className="block p-3 rounded-lg bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-800 hover:border-blue-400 dark:hover:border-blue-600 transition-colors group"
              >
                <p className="text-blue-600 dark:text-blue-400 font-medium group-hover:text-blue-700 dark:group-hover:text-blue-300">
                  {doc.label} →
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{doc.desc}</p>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
