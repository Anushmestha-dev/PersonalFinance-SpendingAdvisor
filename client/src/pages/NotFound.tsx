import { Link } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';

export const NotFound = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6 text-gray-900 dark:text-gray-100">
      <div className="max-w-md w-full text-center space-y-6 bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700/60">
        <div className="inline-block p-4 bg-blue-50 dark:bg-blue-900/30 rounded-2xl">
          <span className="text-6xl font-extrabold text-blue-600 dark:text-blue-400">404</span>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Page Not Found</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            The page you're looking for doesn't exist, has been removed, or is temporarily unavailable.
          </p>
        </div>

        <div className="flex justify-center space-x-3 pt-2">
          <button
            onClick={() => window.history.back()}
            className="flex items-center space-x-2 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Go Back</span>
          </button>

          <Link
            to="/"
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition shadow-sm"
          >
            <Home className="w-4 h-4" />
            <span>Go to Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
