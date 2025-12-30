'use client';

import { useEffect } from 'react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard error:', error);
  }, [error]);

  return (
    <div className="p-6">
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-2xl mx-auto mt-10">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-lg font-semibold text-red-800 mb-2">
              Error Loading Dashboard
            </h3>
            <p className="text-red-700 mb-4">
              We encountered an error while loading this page. This might be due to a network issue or a temporary problem.
            </p>
            
            {process.env.NODE_ENV === 'development' && (
              <details className="mb-4">
                <summary className="cursor-pointer text-sm text-red-600 hover:text-red-800">
                  Technical details
                </summary>
                <pre className="mt-2 p-3 bg-white rounded text-xs overflow-auto border border-red-200">
                  {error.message}
                  {error.stack && `\n\n${error.stack}`}
                </pre>
              </details>
            )}

            <div className="flex gap-3">
              <button
                onClick={reset}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
              >
                Try Again
              </button>
              <a
                href="/dashboard"
                className="bg-white text-red-600 border border-red-600 px-4 py-2 rounded hover:bg-red-50 transition-colors"
              >
                Reload Dashboard
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

