import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Sell from './pages/Sell';
import Alerts from './pages/Alerts';
import Predictions from './pages/Predictions';
import Financials from './pages/Financials';
import ExportData from './pages/ExportData';
import Staff from './pages/Staff';
import Settings from './pages/Settings';
import Help from './pages/Help';
import DashboardLayout from './components/DashboardLayout';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />

      <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout><Dashboard /></DashboardLayout></ProtectedRoute>} />
      <Route path="/inventory" element={<ProtectedRoute><DashboardLayout><Inventory /></DashboardLayout></ProtectedRoute>} />
      <Route path="/sell" element={<ProtectedRoute><DashboardLayout><Sell /></DashboardLayout></ProtectedRoute>} />
      <Route path="/alerts" element={<ProtectedRoute><DashboardLayout><Alerts /></DashboardLayout></ProtectedRoute>} />
      <Route path="/predictions" element={<ProtectedRoute><DashboardLayout><Predictions /></DashboardLayout></ProtectedRoute>} />
      <Route path="/financials" element={<ProtectedRoute adminOnly><DashboardLayout><Financials /></DashboardLayout></ProtectedRoute>} />
      <Route path="/export" element={<ProtectedRoute adminOnly><DashboardLayout><ExportData /></DashboardLayout></ProtectedRoute>} />
      <Route path="/staff" element={<ProtectedRoute adminOnly><DashboardLayout><Staff /></DashboardLayout></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><DashboardLayout><Settings /></DashboardLayout></ProtectedRoute>} />
      <Route path="/help" element={<ProtectedRoute><DashboardLayout><Help /></DashboardLayout></ProtectedRoute>} />

      {/* Legacy route redirect */}
      <Route path="/reports" element={<Navigate to="/export" replace />} />
    </Routes>
  );
}

export default App;
