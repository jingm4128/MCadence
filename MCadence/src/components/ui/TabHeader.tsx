'use client';

import { Button } from '@/components/ui/Button';
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
  return (
    <div className="flex justify-between items-center mb-6">
      <div className="flex gap-2">
        {archivedCount > 0 && (
          <Button
            variant="secondary"
            onClick={onToggleArchive}
          >
            {showArchive ? 'Active' : `Archived (${archivedCount})`}
          </Button>
        )}
        {completedCount > 0 && !showArchive && (
          <Button
            variant="secondary"
            onClick={onArchiveAllCompleted}
            className="text-xs"
          >
            Archive completed ({completedCount})
          </Button>
        )}
        <Button onClick={onAdd} className="font-bold text-lg">
          +
        </Button>
      </div>
      {/* Category Filter */}
      <select
        value={categoryFilter}
        onChange={(e) => onCategoryFilterChange(e.target.value)}
        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
