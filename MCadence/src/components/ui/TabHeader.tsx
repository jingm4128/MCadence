'use client';

import { useRef, useState, useCallback } from 'react';
import { Category } from '@/lib/types';

interface TabHeaderProps {
  // Archive button
  archivedCount: number;
  showArchive: boolean;
  onToggleArchive: () => void;
  
  // Archive completed button
  completedCount: number;
  onArchiveAllCompleted: () => void;
  
  // Add button
  onAdd: () => void;
  
  // Category filter
  categories: Category[];
  categoryFilter: string;
  onCategoryFilterChange: (filter: string) => void;
}

// Unified button style constants
const ICON_BUTTON_BASE = "w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-200 text-base";
const ICON_BUTTON_PRIMARY = `${ICON_BUTTON_BASE} bg-primary-600 text-white hover:bg-primary-700 active:scale-95`;
const ICON_BUTTON_SECONDARY = `${ICON_BUTTON_BASE} bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-95`;
const ICON_BUTTON_ACTIVE = `${ICON_BUTTON_BASE} bg-primary-100 text-primary-700 hover:bg-primary-200 active:scale-95 ring-2 ring-primary-500`;

export function TabHeader({
  archivedCount,
  showArchive,
  onToggleArchive,
  completedCount,
  onArchiveAllCompleted,
  onAdd,
  categories,
  categoryFilter,
  onCategoryFilterChange,
}: TabHeaderProps) {
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isLongPressing, setIsLongPressing] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  // Long press handling for archive button
  const handleArchivePointerDown = useCallback(() => {
    setIsLongPressing(false);
    longPressTimerRef.current = setTimeout(() => {
      setIsLongPressing(true);
      // Trigger archive all completed on long press
      if (completedCount > 0 && !showArchive) {
        onArchiveAllCompleted();
      }
    }, 500); // 500ms for long press
  }, [completedCount, showArchive, onArchiveAllCompleted]);

  const handleArchivePointerUp = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    // If it wasn't a long press, toggle archive view
    if (!isLongPressing) {
      onToggleArchive();
    }
    setIsLongPressing(false);
  }, [isLongPressing, onToggleArchive]);

  const handleArchivePointerLeave = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setIsLongPressing(false);
  }, []);

  // Determine archive button state
  const hasArchivedItems = archivedCount > 0;
  const hasCompletedItems = completedCount > 0 && !showArchive;
  
  // Show archive button when: there are archived items, viewing archive, OR there are completed items to archive
  const showArchiveButton = hasArchivedItems || showArchive || hasCompletedItems;

  return (
    <div className="flex justify-between items-center mb-6">
      <div className="flex gap-2 items-center">
        {/* Archive Icon Button - visible when there are archived items, viewing archive, or completed items */}
        {showArchiveButton && (
          <div className="relative">
            <button
              onPointerDown={handleArchivePointerDown}
              onPointerUp={handleArchivePointerUp}
              onPointerLeave={handleArchivePointerLeave}
              onPointerCancel={handleArchivePointerLeave}
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              className={showArchive ? ICON_BUTTON_ACTIVE : ICON_BUTTON_SECONDARY}
              title={showArchive ? 'Back to Active' : `Archived (${archivedCount})${hasCompletedItems ? ' • Long press to archive completed' : ''}`}
            >
              {/* Archive Box Icon */}
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
              {/* Badge for count */}
              {!showArchive && archivedCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-gray-500 text-white text-xs font-medium rounded-full px-1">
                  {archivedCount > 99 ? '99+' : archivedCount}
                </span>
              )}
              {/* Indicator for completable items (long press hint) */}
              {hasCompletedItems && !showArchive && (
                <span className="absolute -bottom-1 -right-1 w-2 h-2 bg-green-500 rounded-full"></span>
              )}
            </button>
            {/* Tooltip on hover */}
            {showTooltip && hasCompletedItems && !showArchive && (
              <div className="absolute left-0 top-full mt-1 px-2 py-1 bg-gray-800 text-white text-xs rounded shadow-lg whitespace-nowrap z-10">
                Long press to archive {completedCount} completed
              </div>
            )}
          </div>
        )}
        
        {/* Add Button */}
        <button
          onClick={onAdd}
          className={ICON_BUTTON_PRIMARY}
          title="Add new item"
        >
          <span className="text-xl font-bold leading-none">+</span>
        </button>
      </div>
      
      {/* Category Filter */}
      <select
        value={categoryFilter}
        onChange={(e) => onCategoryFilterChange(e.target.value)}
        className="h-9 px-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
      >
        <option value="all">All Categories</option>
        {categories.map((cat) => (
          <option key={cat.id} value={cat.id}>
            {cat.name}
          </option>
        ))}
      </select>
    </div>
  );
}
