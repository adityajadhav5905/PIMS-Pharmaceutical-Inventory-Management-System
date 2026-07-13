import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Pill,
  Bell,
  TrendingUp,
  Settings,
  HelpCircle,
  LogOut,
  X,
  ShoppingCart,
  IndianRupee,
  Download,
  Users,
} from 'lucide-react';
import { useState, useEffect } from 'react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Medicine Inventory', href: '/inventory', icon: Pill },
  { name: 'Sell Stock', href: '/sell', icon: ShoppingCart },
  { name: 'Alerts', href: '/alerts', icon: Bell },
  { name: 'AI Predictions', href: '/predictions', icon: TrendingUp },
];

const secondaryNavigation = [
  { name: 'Financials', href: '/financials', icon: IndianRupee },
  { name: 'Export Data', href: '/export', icon: Download },
  { name: 'Staff', href: '/staff', icon: Users },
  { name: 'Settings', href: '/settings', icon: Settings },
  { name: 'Help', href: '/help', icon: HelpCircle },
];

/** Sidebar navigation with dark-mode support. */
export default function Sidebar({ open, onClose }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) setUser(JSON.parse(userData));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const linkClass = (active) =>
    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
      active
        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
        : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
    }`;

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-gray-900/30 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 transform border-r border-gray-200 bg-white transition-transform duration-200 dark:border-gray-700 dark:bg-gray-800 ${
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } lg:static`}
      >
        <div className="flex h-16 items-center justify-between border-b border-gray-200 px-4 dark:border-gray-700">
          <Link to="/dashboard" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600">
              <Pill className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900 dark:text-gray-100">MedInventory</span>
          </Link>
          <button onClick={onClose} className="text-gray-500 lg:hidden dark:text-gray-400">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4">
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Main Menu
          </p>
          <div className="flex flex-col gap-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                onClick={onClose}
                className={linkClass(location.pathname === item.href)}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            ))}
          </div>

          <p className="mb-2 mt-6 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Other
          </p>
           <div className="flex flex-col gap-1">
             {secondaryNavigation
               .filter((item) => {
                 if (user?.role !== 'Admin') {
                   // Hide Financials, Export Data, and Staff from non-admins
                   return !['Financials', 'Export Data', 'Staff'].includes(item.name);
                 }
                 return true;
               })
               .map((item) => (
                 <Link
                   key={item.name}
                   to={item.href}
                   onClick={onClose}
                   className={linkClass(location.pathname === item.href)}
                 >
                   <item.icon className="h-5 w-5" />
                   {item.name}
                 </Link>
               ))}
           </div>
        </nav>

        <div className="border-t border-gray-200 p-4 dark:border-gray-700">
          {user && (
            <div className="mb-4 rounded-lg bg-gray-50 p-3 dark:bg-gray-900">
              <p className="text-xs text-gray-600 dark:text-gray-400">Logged in as</p>
              <p className="font-medium text-gray-900 dark:text-gray-100">{user.name || user.email}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            <LogOut className="h-5 w-5" />
            Logout
          </button>
        </div>
      </div>
    </>
  );
}
