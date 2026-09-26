import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Search, Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

/** Top bar — search and dark/light mode toggle (replaces bell icon). */
export default function Header({ onMenuClick }) {
  const { theme, toggleTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      navigate(`/inventory?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 dark:border-gray-700 dark:bg-gray-800 md:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 lg:hidden"
        >
          <Menu className="h-6 w-6" />
        </button>

        {/* Theme toggle — upper-left area of header */}
        <button
          onClick={toggleTheme}
          title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100"
        >
          {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
        </button>
      </div>

      <div className="mx-4 hidden max-w-md flex-1 md:block">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search medicine / brand (press Enter)..."
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
        </div>
      </div>

      <div className="w-10" />
    </header>
  );
}
