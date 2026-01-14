interface ProgressBarProps {
  value: number; // 0-1
  max?: number;
  className?: string;
  showWarning?: boolean;
  label?: string;
  isActive?: boolean; // For active timer - shows pulsing animation
  activeProgress?: number; // Additional progress from current session (0-1)
}

export function ProgressBar({
  value,
  max = 1,
  className = '',
  showWarning = false,
  label,
  isActive = false,
  activeProgress = 0
}: ProgressBarProps) {
  const basePercentage = Math.max(0, Math.min(100, (value / max) * 100));
  const activePercentage = Math.max(0, Math.min(100, (activeProgress / max) * 100));
  const totalPercentage = Math.min(100, basePercentage + activePercentage);
  
  return (
    <div className={`w-full ${className}`}>
      {label && (
        <div className="mb-1 flex justify-between text-sm text-gray-600">
          <span>{label}</span>
          <span>{Math.round(totalPercentage)}%</span>
        </div>
      )}
      <div className={`relative h-2 w-full bg-gray-200 rounded-full overflow-hidden ${
        isActive ? 'ring-2 ring-primary-300 ring-opacity-50' : ''
      }`}>
        {/* Base completed progress */}
        <div
          className={`absolute h-full rounded-full transition-all duration-300 ease-out ${
            showWarning ? 'bg-red-500' : 'bg-primary-500'
          } ${showWarning ? 'progress-warning' : ''}`}
          style={{ width: `${basePercentage}%` }}
        />
        {/* Active session progress (additional layer on top) */}
        {isActive && activePercentage > 0 && (
          <div
            className="absolute h-full rounded-full bg-primary-400 animate-pulse"
            style={{
              left: `${basePercentage}%`,
              width: `${activePercentage}%`
            }}
          />
        )}
        {/* Pulsing glow effect when active */}
        {isActive && (
          <div
            className="absolute inset-0 rounded-full animate-pulse"
            style={{
              background: `linear-gradient(90deg, transparent ${basePercentage}%, rgba(59, 130, 246, 0.3) ${basePercentage}%, rgba(59, 130, 246, 0.3) ${totalPercentage}%, transparent ${totalPercentage}%)`
            }}
          />
        )}
      </div>
    </div>
  );
}
