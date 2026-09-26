import { useEffect, useState } from 'react';
import { AlertTriangle, CalendarClock, PackageX, TrendingUp } from 'lucide-react';
import { api } from '../lib/api';
import { formatDate, formatINR, isExpired } from '../lib/format';

/** Dashboard — KPI cards, expiry panel, low-stock list. */
export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadStats = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getDashboardStats();
      setStats(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  if (loading) {
    return <p className="text-gray-500 dark:text-gray-400">Loading dashboard...</p>;
  }

  if (error) {
    return <p className="text-red-600">{error}</p>;
  }

  const cards = [
    {
      label: 'Expired Medicines',
      value: stats.expiredCount,
      icon: PackageX,
      color: 'border-red-500',
      iconColor: 'text-red-500',
    },
    {
      label: 'Expiring within 10 days',
      value: stats.expiringSoonCount,
      icon: CalendarClock,
      color: 'border-orange-500',
      iconColor: 'text-orange-500',
    },
    {
      label: 'Low Stock Items',
      value: stats.lowStockCount,
      icon: AlertTriangle,
      color: 'border-yellow-500',
      iconColor: 'text-yellow-500',
    },
    {
      label: 'Total Profit This Month',
      value: formatINR(stats.profitThisMonth),
      icon: TrendingUp,
      color: 'border-green-500',
      iconColor: 'text-green-500',
      isCurrency: true,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Pharmacy Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400">Welcome back! Here is your inventory overview.</p>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className={`rounded-lg border-l-4 ${card.color} bg-white p-6 shadow dark:bg-gray-800`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{card.label}</p>
                <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {card.isCurrency ? card.value : card.value.toLocaleString('en-IN')}
                </p>
              </div>
              <card.icon className={`h-12 w-12 opacity-20 ${card.iconColor}`} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Expired or expiring soon */}
        <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
          <h2 className="mb-4 text-lg font-bold text-gray-900 dark:text-gray-100">
            {stats.expiryPanelTitle}
          </h2>
          {stats.expiryPanel.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No items in this category.</p>
          ) : (
            <div className="space-y-3">
              {stats.expiryPanel.map((item) => (
                <div
                  key={item._id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-700"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {item.medicineName}
                      {item.brand ? ` (${item.brand})` : ''}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Batch: {item.batchNumber} · Stock: {item.currentStock}
                    </p>
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      isExpired(item.expiryDate)
                        ? 'text-red-600'
                        : 'text-orange-600 dark:text-orange-400'
                    }`}
                  >
                    {formatDate(item.expiryDate)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low stock */}
        <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
          <h2 className="mb-4 text-lg font-bold text-gray-900 dark:text-gray-100">Low Stock Items</h2>
          {stats.lowStockItems.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">All items are above reorder level.</p>
          ) : (
            <div className="space-y-3">
              {stats.lowStockItems.map((item) => (
                <div
                  key={item._id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-700"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {item.medicineName}
                      {item.brand ? ` (${item.brand})` : ''}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Batch: {item.batchNumber}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-red-600">{item.currentStock} left</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Reorder: {item.reorderLevel}
                    </p>
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
