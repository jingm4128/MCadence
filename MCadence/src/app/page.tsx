'use client';

import dynamic from 'next/dynamic';

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
  return <HomePageContent />;
}
