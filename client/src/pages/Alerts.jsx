import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2, XCircle, X } from 'lucide-react';
import { api } from '../lib/api';

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    loadAlerts();
  }, [page, status]);

  const loadAlerts = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.getAlerts(page, 10, status);
      setAlerts(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Track alerts that are pending resolution during their 5-second undo countdown
  const [pendingResolutions, setPendingResolutions] = useState({});

  const handleCloseAlert = (id) => {
    if (pendingResolutions[id]) return;

    let secondsRemaining = 5;

    const intervalId = setInterval(() => {
      setPendingResolutions((prev) => {
        const current = prev[id];
        if (!current) {
          clearInterval(intervalId);
          return prev;
        }
        if (current.secondsRemaining <= 1) {
          clearInterval(intervalId);
          triggerActualClose(id);
          const next = { ...prev };
          delete next[id];
          return next;
        }
        return {
          ...prev,
          [id]: { ...current, secondsRemaining: current.secondsRemaining - 1 }
        };
      });
    }, 1000);

    setPendingResolutions((prev) => ({
      ...prev,
      [id]: { intervalId, secondsRemaining }
    }));
  };

  const triggerActualClose = async (id) => {
    setError('');
    try {
      await api.closeAlert(id);
      loadAlerts();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUndoClose = (id) => {
    const pending = pendingResolutions[id];
    if (pending) {
      clearInterval(pending.intervalId);
      setPendingResolutions((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'High':
        return 'text-red-600 bg-red-50';
      case 'Medium':
        return 'text-yellow-600 bg-yellow-50';
      case 'Low':
        return 'text-green-600 bg-green-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'LOW_STOCK':
        return <AlertCircle className="h-5 w-5" />;
      case 'OVERSTOCK':
        return <AlertCircle className="h-5 w-5" />;
      case 'EXPIRY_WARNING':
        return <XCircle className="h-5 w-5" />;
      default:
        return <AlertCircle className="h-5 w-5" />;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Alerts</h1>
        <p className="text-gray-600 dark:text-gray-400">View and manage system alerts</p>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-lg shadow p-4 dark:bg-gray-800 dark:border dark:border-gray-700">
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Filter by Status</label>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            >
              <option value="">All Alerts</option>
              <option value="active">Active</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3 dark:bg-red-950/20 dark:border-red-900/50">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 dark:text-red-400" />
          <p className="text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Alerts List */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading alerts...</div>
        ) : alerts.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center dark:bg-gray-800 dark:border dark:border-gray-700">
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <p className="text-gray-700 dark:text-gray-200 font-medium">No alerts at the moment</p>
            <p className="text-gray-600 dark:text-gray-400">Keep monitoring your inventory for new alerts</p>
          </div>
        ) : (
          alerts.map((alert) => {
            const isPending = pendingResolutions[alert._id];
            return (
              <div
                key={alert._id}
                className={`rounded-lg shadow border-l-4 p-6 transition-all duration-350 ${
                  isPending
                    ? 'bg-orange-50 dark:bg-orange-950/20 border-orange-500 text-orange-800 dark:text-orange-300 animate-pulse'
                    : alert.isResolved
                    ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-400 dark:border-gray-600 text-gray-800 dark:text-gray-200'
                    : alert.severity === 'High'
                    ? 'bg-red-50 dark:bg-red-950/20 border-red-500 text-red-800 dark:text-red-200'
                    : alert.severity === 'Medium'
                    ? 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-500 text-yellow-800 dark:text-yellow-200'
                    : 'bg-green-50 dark:bg-green-950/20 border-green-500 text-green-800 dark:text-green-200'
                }`}
              >
                {isPending ? (
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="h-5 w-5 text-orange-500" />
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        Alert closed. Disappearing in <span className="font-bold text-orange-600 dark:text-orange-400">{isPending.secondsRemaining} seconds</span>...
                      </span>
                    </div>
                    <button
                      onClick={() => handleUndoClose(alert._id)}
                      className="px-4 py-2 bg-gray-200 text-gray-850 dark:bg-gray-750 dark:text-gray-100 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-650 text-sm font-semibold transition-colors shadow-sm"
                    >
                      Undo Action
                    </button>
                  </div>
                ) : (
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <div className={`mt-1 ${getSeverityColor(alert.severity).split(' ')[0]}`}>
                        {getTypeIcon(alert.type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                            {alert.type.replace(/_/g, ' ')}
                          </h3>
                          {alert.isResolved ? (
                            <span className="inline-block px-2 py-1 bg-green-200 text-green-800 text-xs rounded-full font-medium dark:bg-green-900/40 dark:text-green-300">
                              Resolved
                            </span>
                          ) : (
                            <span className={`inline-block px-2 py-1 text-xs rounded-full font-medium ${getSeverityColor(alert.severity)}`}>
                              {alert.severity}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-700 mt-1 dark:text-gray-300">{alert.message}</p>
                        <div className="flex items-center gap-4 mt-3 text-sm text-gray-600 dark:text-gray-400">
                          <span>{new Date(alert.createdAt).toLocaleString()}</span>
                          {alert.isResolved && alert.closedAt && (
                            <span>Closed: {new Date(alert.closedAt).toLocaleString()}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {!alert.isResolved && (
                      <button
                        onClick={() => handleCloseAlert(alert._id)}
                        disabled={loading}
                        className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 transition-colors"
                      >
                        Close Alert
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {!loading && alerts.length > 0 && (
        <div className="flex justify-between items-center mt-4">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-600 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-gray-600 dark:text-gray-400">Page {page}</span>
          <button
            onClick={() => setPage(page + 1)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-600"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
