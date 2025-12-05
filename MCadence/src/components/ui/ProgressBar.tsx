interface ProgressBarProps {
  value: number; // 0-1
  max?: number;
  className?: string;
  showWarning?: boolean;
  label?: string;
}

export function ProgressBar({ 
  value, 
  max = 1, 
  className = '', 
  showWarning = false,
  label
}: ProgressBarProps) {
  const percentage = Math.max(0, Math.min(100, (value / max) * 100));
  
  return (
    <div className={`w-full ${className}`}>
      {label && (
        <div className="mb-1 flex justify-between text-sm text-gray-600">
          <span>{label}</span>
          <span>{Math.round(percentage)}%</span>
        </div>
      )}
      <div className="relative h-2 w-full bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ease-out ${
            showWarning ? 'bg-red-500' : 'bg-primary-500'
          } ${showWarning ? 'progress-warning' : ''}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
