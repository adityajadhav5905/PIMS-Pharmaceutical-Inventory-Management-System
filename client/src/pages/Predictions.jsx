import { useState, useEffect } from 'react';
import { TrendingUp, AlertCircle, Sparkles, History, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';

const PERIOD_OPTIONS = [
  { label: 'Next 7 Days', value: 7 },
  { label: 'Next 30 Days (Recommended)', value: 30 },
  { label: 'Next 60 Days', value: 60 },
  { label: 'Next 90 Days', value: 90 },
];

/**
 * AI Demand Predictions Page
 *
 * 1. Fetches registered medicines from the catalog on load.
 * 2. Allows the user to select a medicine and a forecast period (7/30/60/90 days).
 * 3. Sends both medicineId + periods to the backend prediction API.
 * 4. Displays Current Stock, Predicted Demand, Recommended Stock, Confidence, Source.
 * 5. Loads and displays prediction history for the pharmacy.
 */
export default function Predictions() {
  const [medicines, setMedicines] = useState([]);
  const [selectedMedicine, setSelectedMedicine] = useState('');
  const [periods, setPeriods] = useState(30);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('predict'); // 'predict' | 'history'
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');

  // Fetch medicines list on mount
  useEffect(() => {
    const fetchMedicines = async () => {
      try {
        const response = await api.getMedicines();
        setMedicines(response.data || []);
      } catch (err) {
        console.error('Failed to load medicines:', err);
        setError('Could not load medicines list from the backend.');
      }
    };
    fetchMedicines();
  }, []);

  // Load prediction history when the history tab is opened
  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab]);

  const loadHistory = async () => {
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const response = await api.getPredictionHistory(1, 50);
      setHistory(response.data || []);
    } catch (err) {
      setHistoryError(err.message || 'Failed to load prediction history.');
    } finally {
      setHistoryLoading(false);
    }
  };

  /**
   * Submit selected medicine + period to backend for AI demand forecasting.
   */
  const handlePredict = async (e) => {
    e.preventDefault();
    if (!selectedMedicine) return;

    setLoading(true);
    setError('');
    setPrediction(null);

    try {
      const response = await api.getPrediction(selectedMedicine, periods);
      if (response.success && response.data) {
        setPrediction(response.data);
      } else {
        throw new Error('Invalid prediction response format.');
      }
    } catch (err) {
      console.error('Prediction request error:', err);
      setError(err.message || 'Error occurred while generating prediction.');
    } finally {
      setLoading(false);
    }
  };

  const sourceLabel = (src) => {
    if (src === 'ml-service') return 'ML Model';
    if (src === 'statistical-fallback') return 'Statistical Fallback';
    return src || 'Unknown';
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">AI Predictions</h1>
        <p className="text-gray-600 dark:text-gray-400">Forecast medicine demand using machine learning</p>
      </div>

      {/* Info Status Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3 dark:bg-blue-950/40 dark:border-blue-900">
        <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 dark:text-blue-400" />
        <div>
          <p className="font-medium text-blue-900 dark:text-blue-300">ML Forecast Engine Active</p>
          <p className="text-sm text-blue-800 dark:text-blue-400">
            Connecting dynamically to the ML forecasting microservice. Statistical fallback is enabled if the ML service is offline.
          </p>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('predict')}
          className={`px-4 py-2 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'predict'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <Sparkles className="h-4 w-4" />
          Get Prediction
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'history'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <History className="h-4 w-4" />
          History
        </button>
      </div>

      {/* ─── PREDICT TAB ─── */}
      {activeTab === 'predict' && (
        <>
          {/* Error alert */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3 text-red-700 dark:bg-red-950/30 dark:border-red-900 dark:text-red-400">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Prediction Query Form */}
          <div className="bg-white rounded-lg shadow p-6 dark:bg-gray-800">
            <h2 className="text-lg font-bold text-gray-900 mb-4 dark:text-gray-100 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-600" /> Get Prediction
            </h2>

            <form onSubmit={handlePredict} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
                  Select Medicine from Database
                </label>
                <select
                  value={selectedMedicine}
                  onChange={(e) => setSelectedMedicine(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-750 dark:border-gray-600 dark:text-gray-100"
                  required
                >
                  <option value="">-- Choose a medicine --</option>
                  {medicines.map((med) => (
                    <option key={med._id} value={med._id}>
                      {med.name} {med.brand ? `(${med.brand})` : ''} - SKU: {med.sku}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
                  Prediction Period
                </label>
                <select
                  value={periods}
                  onChange={(e) => setPeriods(Number(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-750 dark:border-gray-600 dark:text-gray-100"
                >
                  {PERIOD_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={!selectedMedicine || loading}
                className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Generating Prediction...' : 'Get Prediction'}
              </button>
            </form>
          </div>

          {/* Prediction Results Display */}
          {prediction && (
            <div className="bg-white rounded-lg shadow p-6 dark:bg-gray-800">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Prediction Results</h2>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  prediction.source === 'ml-service'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                }`}>
                  Source: {sourceLabel(prediction.source)}
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 dark:bg-blue-950/20 dark:border-blue-900">
                  <p className="text-gray-600 dark:text-gray-400 text-sm">Medicine</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2 capitalize">{prediction.medicine}</p>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 dark:bg-yellow-950/20 dark:border-yellow-900">
                  <p className="text-gray-600 dark:text-gray-400 text-sm">Current Stock</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">{prediction.currentStock} units</p>
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 dark:bg-purple-950/20 dark:border-purple-900">
                  <p className="text-gray-600 dark:text-gray-400 text-sm">Predicted Demand ({prediction.periods}d)</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">{prediction.predictedDemand} units</p>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4 dark:bg-green-950/20 dark:border-green-900">
                  <p className="text-gray-600 dark:text-gray-400 text-sm">Confidence</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">{Math.round(prediction.confidence * 100)}%</p>
                </div>
              </div>

              {/* Recommendation */}
              <div className="mt-6 bg-gray-50 rounded-lg p-4 border border-gray-200 dark:bg-gray-750 dark:border-gray-700">
                <div className="flex items-start gap-3">
                  <TrendingUp className="h-5 w-5 text-green-600 mt-1 flex-shrink-0 dark:text-green-400" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-200">Recommended Stock Adjustment</p>
                    <p className="text-gray-700 dark:text-gray-300 mt-1">
                      Based on the AI demand forecast, maintain a stock level of <strong>{prediction.recommendedStock}</strong> units
                      (20% safety buffer) to satisfy the predicted {prediction.predictedDemand} unit demand
                      by <strong>{prediction.predictedDate}</strong>.
                      {prediction.currentStock < prediction.predictedDemand && (
                        <span className="ml-2 text-red-600 dark:text-red-400 font-medium">
                          ⚠ Replenishment alert generated — current stock insufficient.
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── HISTORY TAB ─── */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-lg shadow p-6 dark:bg-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <History className="h-5 w-5" /> Prediction History
            </h2>
            <button
              onClick={loadHistory}
              disabled={historyLoading}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${historyLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {historyError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm dark:bg-red-950/30 dark:text-red-400 mb-4">
              {historyError}
            </div>
          )}

          {historyLoading ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading history...</div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No predictions yet. Run a prediction to see history here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-3 text-gray-600 dark:text-gray-400 font-medium">Medicine</th>
                    <th className="text-left py-2 px-3 text-gray-600 dark:text-gray-400 font-medium">Prediction Date</th>
                    <th className="text-left py-2 px-3 text-gray-600 dark:text-gray-400 font-medium">Confidence</th>
                    <th className="text-left py-2 px-3 text-gray-600 dark:text-gray-400 font-medium">Source</th>
                    <th className="text-left py-2 px-3 text-gray-600 dark:text-gray-400 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="py-2 px-3 font-medium text-gray-900 dark:text-gray-200">{h.medicineName}</td>
                      <td className="py-2 px-3 text-gray-600 dark:text-gray-400">
                        {h.predictionDate ? new Date(h.predictionDate).toLocaleDateString() : '-'}
                      </td>
                      <td className="py-2 px-3 text-gray-700 dark:text-gray-300">
                        {Math.round(Number(h.confidence) * 100)}%
                      </td>
                      <td className="py-2 px-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          h.source === 'ml-service'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                        }`}>
                          {sourceLabel(h.source)}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-gray-500 dark:text-gray-400 text-xs">
                        {new Date(h.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
