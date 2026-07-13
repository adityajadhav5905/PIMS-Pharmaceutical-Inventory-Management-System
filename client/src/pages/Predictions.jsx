import { useState, useEffect } from 'react';
import { TrendingUp, AlertCircle, Sparkles } from 'lucide-react';
import { api } from '../lib/api';

/**
 * AI Demand Predictions Page
 * 
 * 1. Fetches a list of registered medicines from the catalog on load.
 * 2. Allows the user to select a medicine and request a 30-day demand forecast.
 * 3. Sends a request to the backend prediction API (which queries the ML model or fallback).
 * 4. Displays real-time metrics including Current Stock, Predicted Demand,
 *    Model Confidence (%), and a Recommended Reorder Stock level.
 */
export default function Predictions() {
  const [medicines, setMedicines] = useState([]);
  const [selectedMedicine, setSelectedMedicine] = useState('');
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch medicines from the database when the page is loaded
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

  /**
   * Submit selected medicine ID to backend to trigger AI demand forecasting.
   */
  const handlePredict = async (e) => {
    e.preventDefault();
    if (!selectedMedicine) return;

    setLoading(true);
    setError('');
    setPrediction(null);
    
    try {
      // Call predictions API endpoint
      const response = await api.getPrediction(selectedMedicine);
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
            Connecting dynamically to the ML forecasting microservice. In-app statistical fallback is enabled if the ML service is offline.
          </p>
        </div>
      </div>

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
              Prediction Period (Days)
            </label>
            <select
              defaultValue="30"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-750 dark:border-gray-600 dark:text-gray-100"
            >
              <option value="30">Next 30 Days (Recommended)</option>
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
          <h2 className="text-lg font-bold text-gray-900 mb-4 dark:text-gray-100">Prediction Results</h2>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Result Card 1 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 dark:bg-blue-950/20 dark:border-blue-900">
              <p className="text-gray-600 dark:text-gray-400 text-sm">Medicine</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2 capitalize">{prediction.medicine}</p>
            </div>

            {/* Result Card 2 */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 dark:bg-yellow-950/20 dark:border-yellow-900">
              <p className="text-gray-600 dark:text-gray-400 text-sm">Current Stock</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">{prediction.currentStock} units</p>
            </div>

            {/* Result Card 3 */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 dark:bg-purple-950/20 dark:border-purple-900">
              <p className="text-gray-600 dark:text-gray-400 text-sm">Predicted Demand</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">{prediction.predictedDemand} units</p>
            </div>

            {/* Result Card 4 */}
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
                  to successfully satisfy the predicted demand by <strong>{prediction.predictedDate}</strong>.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

