'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';

// Dynamically import HomePage with no SSR to avoid hydration issues
const HomePageContent = dynamic(() => import('@/components/HomePageContent'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  ),
});

export default function HomePage() {
  const [loadTimeout, setLoadTimeout] = useState(false);

  useEffect(() => {
    // If loading takes more than 10 seconds, show reload option
    const timer = setTimeout(() => {
      setLoadTimeout(true);
    }, 10000);

    return () => clearTimeout(timer);
  }, []);

  const handleForceReload = async () => {
    try {
      // Unregister service worker
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }

      // Clear all caches
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map((name) => caches.delete(name)));
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
    } finally {
      // Force reload
      window.location.reload();
    }
  };

  if (loadTimeout) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-yellow-600 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading Issue Detected</h2>
          <p className="text-gray-600 mb-6">
            The app is taking longer than expected to load. This might be due to cached data.
          </p>
          <button
            onClick={handleForceReload}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Clear Cache & Reload
          </button>
        </div>
      </div>
    );
  }

  return <HomePageContent />;
}
