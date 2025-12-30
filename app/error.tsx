'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full">
        <div className="text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Something went wrong!
          </h2>
          <p className="text-gray-600 mb-6">
            We encountered an unexpected error. Please try again.
          </p>
          
          {process.env.NODE_ENV === 'development' && (
            <details className="mb-4 text-left">
              <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                Error details (dev only)
              </summary>
              <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-auto">
                {error.message}
              </pre>
            </details>
          )}

          <button
            onClick={reset}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors w-full"
          >
            Try again
          </button>
          
          <a
            href="/dashboard"
            className="block mt-3 text-sm text-gray-600 hover:text-gray-800"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}

