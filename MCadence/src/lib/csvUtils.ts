import { AppState, Item, ActionLog } from './types';
import { isChecklistItem, isTimeProject } from './types';

// Export items to CSV
export function exportItemsToCSV(items: Item[]): string {
  const headers = [
    'id',
    'tab',
    'title',
    'category',
    'color',
    'sortKey',
    'status',
    'createdAt',
    'updatedAt',
    'archivedAt',
    'isDone',
    'completedAt',
    'frequency',
    'requiredMinutes',
    'completedMinutes',
    'currentSessionStart',
    'periodStart',
    'periodEnd'
  ];

  const rows = items.map(item => {
    const baseRow = {
      id: item.id,
      tab: item.tab,
      title: item.title,
      category: item.category,
      color: item.color,
      sortKey: item.sortKey,
      status: item.status,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      archivedAt: item.archivedAt || '',
    };

    if (isChecklistItem(item)) {
      return {
        ...baseRow,
        isDone: item.isDone,
        completedAt: item.completedAt || '',
        frequency: '',
        requiredMinutes: '',
        completedMinutes: '',
        currentSessionStart: '',
        periodStart: '',
        periodEnd: ''
      };
    } else if (isTimeProject(item)) {
      return {
        ...baseRow,
        isDone: '',
        completedAt: '',
        frequency: item.frequency,
        requiredMinutes: item.requiredMinutes,
        completedMinutes: item.completedMinutes,
        currentSessionStart: item.currentSessionStart || '',
        periodStart: item.periodStart,
        periodEnd: item.periodEnd
      };
    }

    return baseRow;
  });

  return convertToCSV(headers, rows);
}

// Export actions to CSV
export function exportActionsToCSV(actions: ActionLog[]): string {
  const headers = ['id', 'itemId', 'tab', 'type', 'timestamp', 'payloadJson'];

  const rows = actions.map(action => ({
    id: action.id,
    itemId: action.itemId,
    tab: action.tab,
    type: action.type,
    timestamp: action.timestamp,
    payloadJson: action.payload ? JSON.stringify(action.payload) : ''
  }));

  return convertToCSV(headers, rows);
}

// Generic CSV converter
function convertToCSV(headers: string[], rows: any[]): string {
  const csvHeaders = headers.join(',');
  
  const csvRows = rows.map(row => {
    return headers.map(header => {
      const value = row[header] || '';
      // Escape quotes and commas
      const escaped = value.toString().replace(/"/g, '""');
      return `"${escaped}"`;
    }).join(',');
  });

  return [csvHeaders, ...csvRows].join('\n');
}

// Parse CSV string to rows
export function parseCSV(csvString: string): any[] {
  const lines = csvString.split('\n');
  if (lines.length === 0) return [];

  const headers = lines[0].split(',').map(h => h.replace(/^"(.*)"$/, '$1'));
  
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.replace(/^"(.*)"$/, '$1'));
    const row: any = {};
    
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    
    return row;
  }).filter(row => Object.keys(row).some(key => row[key].trim()));
}

// Import items from CSV
export function importItemsFromCSV(csvString: string): Item[] {
  try {
    const rows = parseCSV(csvString);
    
    return rows.map(row => {
      const baseItem = {
        id: row.id || '',
        tab: row.tab || 'dayToDay',
        title: row.title || '',
        category: row.category || '',
        color: row.color || '#3b82f6',
        sortKey: parseInt(row.sortKey) || Date.now(),
        status: (row.status as any) || 'active',
        createdAt: row.createdAt || new Date().toISOString(),
        updatedAt: row.updatedAt || new Date().toISOString(),
        archivedAt: row.archivedAt || null
      };

      if (row.tab === 'spendMyTime') {
        return {
          ...baseItem,
          tab: 'spendMyTime',
          frequency: row.frequency || 'weekly',
          requiredMinutes: parseInt(row.requiredMinutes) || 0,
          completedMinutes: parseInt(row.completedMinutes) || 0,
          currentSessionStart: row.currentSessionStart || null,
          periodStart: row.periodStart || new Date().toISOString(),
          periodEnd: row.periodEnd || new Date().toISOString()
        };
      } else {
        return {
          ...baseItem,
          tab: row.tab === 'hitMyGoal' ? 'hitMyGoal' : 'dayToDay',
          isDone: row.isDone === 'true',
          completedAt: row.completedAt || null
        };
      }
    });
  } catch (error) {
    console.error('Error parsing CSV:', error);
    return [];
  }
}

// Import actions from CSV
export function importActionsFromCSV(csvString: string): ActionLog[] {
  try {
    const rows = parseCSV(csvString);
    
    return rows.map(row => ({
      id: row.id || '',
      itemId: row.itemId || '',
      tab: (row.tab as any) || 'dayToDay',
      type: (row.type as any) || 'create',
      timestamp: row.timestamp || new Date().toISOString(),
      payload: row.payloadJson ? JSON.parse(row.payloadJson) : undefined
    }));
  } catch (error) {
    console.error('Error parsing actions CSV:', error);
    return [];
  }
}

// Download CSV file
export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}
