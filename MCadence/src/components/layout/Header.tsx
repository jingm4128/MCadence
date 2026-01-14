'use client';

interface HeaderProps {
  title: string;
  onMenuClick: () => void;
  onAIClick?: () => void;
}

export function Header({ title, onMenuClick, onAIClick }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 safe-area-padding">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        
        {/* Right side buttons */}
        <div className="flex items-center gap-2">
          {/* AI Button - top center style, placed right of center */}
          {onAIClick && (
            <button
              onClick={onAIClick}
              className="px-3 py-1.5 text-sm font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors flex items-center gap-1.5"
              aria-label="AI Insight"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              AI
            </button>
          )}
          
          {/* Menu Button */}
          <button
            onClick={onMenuClick}
            className="p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors tap-target"
            aria-label="Menu"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
