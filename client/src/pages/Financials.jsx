import { useEffect, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  IndianRupee,
  Receipt,
  AlertCircle,
  Users
} from 'lucide-react';
import { api } from '../lib/api';
import { formatDate, formatINR } from '../lib/format';

/** Financial overview — sales, costs, profit, margin analysis. */
export default function Financials() {
  const [data, setData] = useState(null);
  const [employeePerf, setEmployeePerf] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadFinancials = async () => {
    setLoading(true);
    try {
      const [summaryRes, perfRes] = await Promise.all([
        api.getFinancialSummary(),
        api.getEmployeePerformance()
      ]);
      setData(summaryRes.data);
      setEmployeePerf(perfRes.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFinancials();
  }, []);

  if (loading) return <p className="text-gray-500 dark:text-gray-400">Loading financials...</p>;
  if (error) {
    return (
      <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
        <AlertCircle className="h-5 w-5 text-red-600" />
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  const summaryCards = [
    { label: 'Total Sales (Revenue)', value: formatINR(data.totalRevenue), icon: IndianRupee },
    { label: 'Total Cost', value: formatINR(data.totalCost), icon: Receipt },
    { label: 'Total Profit', value: formatINR(data.totalProfit), icon: TrendingUp },
    { label: 'Profit This Month', value: formatINR(data.monthProfit), icon: TrendingUp },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Financials</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Sales, costs, and profit analysis (all amounts in INR).
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <div key={card.label} className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{card.label}</p>
                <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {card.value}
                </p>
              </div>
              <card.icon className="h-10 w-10 text-blue-500 opacity-30" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 text-sm text-gray-600 dark:text-gray-400 md:grid-cols-3">
        <p>Total sales transactions: {data.totalSalesCount}</p>
        <p>Sales this month: {data.monthSalesCount}</p>
        <p>Month revenue: {formatINR(data.monthRevenue)}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Highest margin */}
        <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-green-700 dark:text-green-400">
            <TrendingUp className="h-5 w-5" /> Highest Margin Items
          </h2>
          {(data.highestMarginItems || data.topMarginItems || []).length === 0 ? (
            <p className="text-gray-500">No pricing data yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b dark:border-gray-700">
                  <th className="py-2 text-left">Medicine</th>
                  <th className="py-2 text-right">Buy</th>
                  <th className="py-2 text-right">Sell</th>
                  <th className="py-2 text-right">Margin</th>
                </tr>
              </thead>
              <tbody>
                {(data.highestMarginItems || data.topMarginItems || []).map((item) => (
                  <tr key={item.name} className="border-b dark:border-gray-700">
                    <td className="py-2 text-gray-900 dark:text-gray-100">{item.name}</td>
                    <td className="py-2 text-right">{formatINR(item.buyingPrice)}</td>
                    <td className="py-2 text-right">{formatINR(item.sellingPrice)}</td>
                    <td className="py-2 text-right font-medium text-green-600">
                      {item.marginPercent}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Lowest margin */}
        <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-red-700 dark:text-red-400">
            <TrendingDown className="h-5 w-5" /> Lowest Margin Items
          </h2>
          {(data.lowestMarginItems || []).length === 0 ? (
            <p className="text-gray-500">No pricing data yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b dark:border-gray-700">
                  <th className="py-2 text-left">Medicine</th>
                  <th className="py-2 text-right">Buy</th>
                  <th className="py-2 text-right">Sell</th>
                  <th className="py-2 text-right">Margin</th>
                </tr>
              </thead>
              <tbody>
                {(data.lowestMarginItems || []).map((item) => (
                  <tr key={item.name} className="border-b dark:border-gray-700">
                    <td className="py-2 text-gray-900 dark:text-gray-100">{item.name}</td>
                    <td className="py-2 text-right">{formatINR(item.buyingPrice)}</td>
                    <td className="py-2 text-right">{formatINR(item.sellingPrice)}</td>
                    <td className="py-2 text-right font-medium text-red-600">
                      {item.marginPercent}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Employee Sales Performance */}
      <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-gray-100">
            <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" /> Employee Sales Performance
          </h2>
          <button
            onClick={() => api.downloadStaffPerformanceCsv()}
            className="flex items-center gap-2 rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
          >
            Download CSV
          </button>
        </div>
        {employeePerf.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">No active employees found or registered yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b dark:border-gray-700">
                <tr>
                  <th className="px-4 py-2 text-left">Employee</th>
                  <th className="px-4 py-2 text-left">Role / Department</th>
                  <th className="px-4 py-2 text-right">Transactions</th>
                  <th className="px-4 py-2 text-right">Total Revenue</th>
                  <th className="px-4 py-2 text-right">Total Profit</th>
                  <th className="px-4 py-2 text-right">Avg Margin</th>
                </tr>
              </thead>
              <tbody>
                {employeePerf.map((emp) => {
                  const marginPercent = emp.totalRevenue > 0 
                    ? Math.round((emp.totalProfit / emp.totalRevenue) * 100) 
                    : 0;
                  return (
                    <tr key={emp._id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900 dark:text-gray-100">{emp.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{emp.email}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                        {emp.position} · <span className="text-xs">{emp.department}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100">{emp.salesCount}</td>
                      <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100 font-medium">
                        {formatINR(emp.totalRevenue)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-green-600 dark:text-green-400">
                        {formatINR(emp.totalProfit)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100 font-semibold">
                        {marginPercent}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent sales */}
      <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
        <h2 className="mb-4 text-lg font-bold text-gray-900 dark:text-gray-100">Recent Sales</h2>
        {(data.recentSales || []).length === 0 ? (
          <p className="text-gray-500">No sales recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b dark:border-gray-700">
                <tr>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">Medicine</th>
                  <th className="px-4 py-2 text-right">Qty</th>
                  <th className="px-4 py-2 text-right">Revenue</th>
                  <th className="px-4 py-2 text-right">Cost</th>
                  <th className="px-4 py-2 text-right">Profit</th>
                </tr>
              </thead>
              <tbody>
                {(data.recentSales || []).map((sale) => (
                  <tr key={sale._id} className="border-b dark:border-gray-700">
                    <td className="px-4 py-3">{formatDate(sale.createdAt)}</td>
                    <td className="px-4 py-3">{sale.medicineName}</td>
                    <td className="px-4 py-3 text-right">{sale.quantity}</td>
                    <td className="px-4 py-3 text-right">{formatINR(sale.totalRevenue)}</td>
                    <td className="px-4 py-3 text-right">{formatINR(sale.totalCost)}</td>
                    <td className="px-4 py-3 text-right font-medium text-green-600">
                      {formatINR(sale.profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
