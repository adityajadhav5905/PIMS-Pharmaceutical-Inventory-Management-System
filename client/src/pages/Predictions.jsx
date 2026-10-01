import { useState, useEffect } from 'react';
import { Sparkles, History, RefreshCw, Layers, ShieldCheck, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api';

const PERIOD_OPTIONS = [
  { label: '7 Days', value: 7 },
  { label: '30 Days (Standard)', value: 30 },
  { label: '60 Days', value: 60 },
  { label: '90 Days (Quarterly)', value: 90 },
];

const VALID_ATC_PREFIXES = ['M01AB', 'M01AE', 'N02BA', 'N02BE', 'N05B', 'N05C', 'R03', 'R06'];

const isSupportedCategory = (cat) => {
  if (!cat) return false;
  const upper = String(cat).toUpperCase().trim();
  if (upper.includes('OTHER')) return false;
  return VALID_ATC_PREFIXES.some((prefix) => upper.startsWith(prefix) || upper === prefix);
};

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
   * Submit selected medicine + period to backend for demand forecasting.
   */
  const handlePredict = async (e) => {
    e.preventDefault();
    if (!selectedMedicine) return;

    const med = medicines.find((m) => String(m._id || m.id) === String(selectedMedicine));
    if (!isSupportedCategory(med?.category)) {
      setError(`Cannot forecast demand for "${med?.name}". It is categorized under "${med?.category || 'Other'}", which has no predefined WHO ATC seasonal demand model.`);
      return;
    }

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

  const selectedMedObj = medicines.find((m) => String(m._id || m.id) === String(selectedMedicine));
  const isMedSupported = isSupportedCategory(selectedMedObj?.category);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Demand Forecasting</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Forecast medicine stock requirements using WHO ATC seasonal demand models
          </p>
        </div>

        {/* Prediction Engine Source Indicator */}
        {prediction && (
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <span
              className={`h-2 w-2 rounded-full ${
                prediction.source === 'deterministic-forecast' ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
            <span>
              Engine:{' '}
              <strong className="text-slate-900 dark:text-slate-100">
                {prediction.source === 'deterministic-forecast' ? 'Deterministic Seasonal Model' : 'Baseline Estimation'}
              </strong>
            </span>
          </div>
        )}
      </div>

      {/* Tab navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('predict')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'predict'
              ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
              : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Sparkles className="h-4 w-4" />
          Forecast Demand
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'history'
              ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
              : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <History className="h-4 w-4" />
          Forecast History
        </button>
      </div>

      {/* ─── PREDICT TAB ─── */}
      {activeTab === 'predict' && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Prediction Query Form */}
          <div className="lg:col-span-1">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-4 text-base font-semibold text-slate-900 dark:text-slate-100">
                Forecast Parameters
              </h2>

              {error && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
                  {error}
                </div>
              )}

              <form onSubmit={handlePredict} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    Medicine *
                  </label>
                  <select
                    value={selectedMedicine}
                    onChange={(e) => {
                      setSelectedMedicine(e.target.value);
                      setError('');
                      setPrediction(null);
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    required
                  >
                    <option value="">-- Choose Medicine --</option>
                    {medicines.map((med) => {
                      const supported = isSupportedCategory(med.category);
                      return (
                        <option key={med._id || med.id} value={med._id || med.id}>
                          {med.name} {med.brand ? `(${med.brand})` : ''} — {med.category || 'Other'} {!supported ? '[No Forecast]' : ''}
                        </option>
                      );
                    })}
                  </select>

                  {selectedMedObj && (
                    <div className="mt-2.5 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                        <Layers className="h-3.5 w-3.5 text-slate-400" />
                        <span>Category:</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {selectedMedObj.category || 'Other'}
                        </span>
                      </div>

                      {!isMedSupported && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
                          <strong>No Forecast Available:</strong> This medicine is categorized under &quot;{selectedMedObj.category || 'Other'}&quot;. Demand forecasting is only available for the 8 WHO ATC categories.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    Forecast Horizon
                  </label>
                  <select
                    value={periods}
                    onChange={(e) => setPeriods(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {PERIOD_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={!selectedMedicine || loading || (selectedMedObj && !isMedSupported)}
                  className="mt-2 w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {selectedMedObj && !isMedSupported
                    ? 'No Forecast for Other Category'
                    : loading
                    ? 'Running Forecast...'
                    : 'Calculate Forecast'}
                </button>
              </form>
            </div>
          </div>

          {/* Forecast Results Display */}
          <div className="lg:col-span-2">
            {prediction ? (
              <div className="space-y-4">
                {/* Result KPI Grid */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Medicine
                    </p>
                    <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100 capitalize truncate">
                      {prediction.medicine}
                    </p>
                    <span className="mt-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {prediction.category}
                    </span>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      In Stock
                    </p>
                    <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
                      {prediction.currentStock}
                    </p>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">Current units</span>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                      Predicted Demand
                    </p>
                    <p className="mt-1 text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {prediction.predictedDemand}
                    </p>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Next {prediction.periods} days
                    </span>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Target Buffer
                    </p>
                    <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
                      {prediction.recommendedStock}
                    </p>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">+20% safety buffer</span>
                  </div>
                </div>

                {/* Stock Status Indicator */}
                {prediction.currentStock < prediction.predictedDemand ? (
                  <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300">
                    <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                    <div>
                      <p className="font-semibold">Reorder Recommended</p>
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        Current stock ({prediction.currentStock}) is below projected demand ({prediction.predictedDemand} units). Shortage of {prediction.predictedDemand - prediction.currentStock} units expected.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300">
                    <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <div>
                      <p className="font-semibold">Stock Level Adequate</p>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">
                        Current inventory covers the projected {prediction.periods}-day demand requirement.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900">
                <Sparkles className="h-8 w-8 text-slate-400" />
                <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                  Select a medicine and click Calculate Forecast
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Forecasts use historical velocity scaled by seasonal category patterns.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── HISTORY TAB ─── */}
      {activeTab === 'history' && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Past Demand Predictions
            </h2>
            <button
              onClick={loadHistory}
              disabled={historyLoading}
              className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${historyLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {historyError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-400">
              {historyError}
            </div>
          )}

          {historyLoading ? (
            <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">Loading history...</div>
          ) : history.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No forecasts recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <tr>
                    <th className="py-2.5 px-3">Medicine</th>
                    <th className="py-2.5 px-3">SKU</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Confidence</th>
                    <th className="py-2.5 px-3">Source Engine</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {history.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-slate-200">
                        {h.medicineName}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                        {h.medicineSku || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-slate-500 dark:text-slate-400">
                        {h.createdAt ? new Date(h.createdAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-slate-700 dark:text-slate-300">
                        {Math.round(Number(h.confidence) * 100)}%
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                            h.source === 'deterministic-forecast'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                          }`}
                        >
                          {h.source === 'deterministic-forecast' ? 'Seasonal Model' : 'Baseline'}
                        </span>
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
