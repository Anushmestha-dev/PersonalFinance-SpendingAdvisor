import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { 
  LayoutDashboard, 
  Receipt, 
  PieChart, 
  Target, 
  LogOut, 
  Menu, 
  MessageSquare, 
  Bell, 
  AlertTriangle, 
  AlertOctagon, 
  CheckCircle, 
  X 
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { fetchApi } from '../lib/api';
import { formatINR } from '../lib/currency';

interface AlertItem {
  id: string;
  category: string;
  budgeted: number;
  spent: number;
  percent: number;
  type: 'WARNING' | 'OVER_BUDGET';
  severity: 'warning' | 'danger';
  message: string;
}

export const Layout = () => {
  const { user, setUser } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Alerts State
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [alertsCount, setAlertsCount] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadAlerts = async () => {
    try {
      const res = await fetchApi('/api/alerts');
      if (res && Array.isArray(res.alerts)) {
        setAlerts(res.alerts);
        setAlertsCount(res.count || res.alerts.length);
      }
    } catch {
      // Silently fail if alerts service is loading
    }
  };

  useEffect(() => {
    loadAlerts();
    const interval = setInterval(loadAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setUser(null);
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Accounts', path: '/accounts', icon: LayoutDashboard },
    { name: 'Transactions', path: '/transactions', icon: Receipt },
    { name: 'Budgets', path: '/budgets', icon: PieChart },
    { name: 'Goals', path: '/goals', icon: Target },
    { name: 'AI Adviser', path: '/chat', icon: MessageSquare },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 shadow-lg transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-transform duration-200 ease-in-out`}>
        <div className="h-16 flex items-center justify-center border-b dark:border-gray-700">
          <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">FinSense</h1>
        </div>
        <nav className="p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link 
                key={item.path} 
                to={item.path} 
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center space-x-3 p-3 rounded-lg transition-colors ${isActive ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64 transition-all">
        <header className="h-16 bg-white dark:bg-gray-800 shadow-sm flex items-center justify-between px-4 lg:px-8">
          <button className="lg:hidden p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex-1"></div>
          
          <div className="flex items-center space-x-4">
            {/* Overspending Alerts Bell */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="relative p-2 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                title="Overspending Alerts"
                aria-label="Overspending Alerts"
              >
                <Bell className="w-5 h-5" />
                {alertsCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center border-2 border-white dark:border-gray-800 animate-pulse">
                    {alertsCount}
                  </span>
                )}
              </button>

              {/* Alerts Dropdown */}
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700 flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                        Budget Alerts ({alertsCount})
                      </h4>
                    </div>
                    <button 
                      onClick={() => setDropdownOpen(false)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y dark:divide-gray-700">
                    {alerts.length === 0 ? (
                      <div className="p-6 text-center space-y-2">
                        <CheckCircle className="w-8 h-8 text-green-500 mx-auto" />
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">All Budgets on Track</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">No categories have exceeded 80% of their monthly limit.</p>
                      </div>
                    ) : (
                      alerts.map((alert) => (
                        <div 
                          key={alert.id}
                          className={`p-3.5 flex items-start space-x-3 transition hover:bg-gray-50 dark:hover:bg-gray-700/30 ${
                            alert.type === 'OVER_BUDGET' ? 'bg-red-50/40 dark:bg-red-900/10' : 'bg-amber-50/40 dark:bg-amber-900/10'
                          }`}
                        >
                          <div className="mt-0.5 flex-shrink-0">
                            {alert.type === 'OVER_BUDGET' ? (
                              <div className="p-1.5 bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg">
                                <AlertOctagon className="w-4 h-4" />
                              </div>
                            ) : (
                              <div className="p-1.5 bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 rounded-lg">
                                <AlertTriangle className="w-4 h-4" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                                {alert.category}
                              </p>
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                alert.type === 'OVER_BUDGET' 
                                  ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' 
                                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                              }`}>
                                {alert.percent}%
                              </span>
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                              Spent {formatINR(alert.spent)} of {formatINR(alert.budgeted)}
                            </p>
                            <p className="text-[11px] font-medium mt-1 text-gray-500 dark:text-gray-400">
                              {alert.type === 'OVER_BUDGET' ? 'Over budget by ' + formatINR(alert.spent - alert.budgeted) : 'Approaching monthly budget threshold'}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="p-2.5 bg-gray-50 dark:bg-gray-700/50 border-t dark:border-gray-700 text-center">
                    <Link
                      to="/budgets"
                      onClick={() => setDropdownOpen(false)}
                      className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline inline-block"
                    >
                      Manage Category Budgets →
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <span className="text-sm font-medium">{user?.name}</span>
            <button onClick={handleLogout} className="p-2 text-gray-500 hover:text-red-600 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Logout">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      
      {/* Overlay */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}
    </div>
  );
};
