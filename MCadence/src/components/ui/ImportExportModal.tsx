import { useState } from 'react';
import { AppState, ActionLog } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { importItemsFromCSV, importActionsFromCSV } from '@/lib/csvUtils';

interface ImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: { state: AppState; mode: 'combine' | 'overwrite' }) => void;
}

export function ImportExportModal({ isOpen, onClose, onImport }: ImportExportModalProps) {
  const [itemsFile, setItemsFile] = useState<File | null>(null);
  const [actionsFile, setActionsFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<'combine' | 'overwrite'>('combine');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleItemsFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'text/csv') {
      setItemsFile(file);
      setError(null);
    } else {
      setError('Please select a valid CSV file for items');
    }
  };

  const handleActionsFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'text/csv') {
      setActionsFile(file);
      setError(null);
    } else {
      setError('Please select a valid CSV file for actions');
    }
  };

  const handleImport = async () => {
    if (!itemsFile) {
      setError('Items file is required');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Read items file
      const itemsText = await itemsFile.text();
      const items = importItemsFromCSV(itemsText);

      // Read actions file if provided
      let actions: ActionLog[] = [];
      if (actionsFile) {
        const actionsText = await actionsFile.text();
        actions = importActionsFromCSV(actionsText);
      }

      // Create imported state
      const importedState: AppState = {
        items,
        actions,
        categories: [] // Will be populated from constants
      };

      onImport({ state: importedState, mode: importMode });
      onClose();
      
      // Reset form
      setItemsFile(null);
      setActionsFile(null);
      setImportMode('combine');
    } catch (err) {
      setError(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Import Data">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Items CSV * (required)
          </label>
          <input
            type="file"
            accept=".csv"
            onChange={handleItemsFileChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          {itemsFile && (
            <p className="mt-1 text-sm text-green-600">Selected: {itemsFile.name}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Actions CSV (optional)
          </label>
          <input
            type="file"
            accept=".csv"
            onChange={handleActionsFileChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          {actionsFile && (
            <p className="mt-1 text-sm text-green-600">Selected: {actionsFile.name}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Import Mode
          </label>
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="radio"
                value="combine"
                checked={importMode === 'combine'}
                onChange={(e) => setImportMode(e.target.value as 'combine' | 'overwrite')}
                className="mr-2"
              />
              <span className="text-sm">
                <strong>Combine</strong> - Merge imported data with existing data
              </span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="overwrite"
                checked={importMode === 'overwrite'}
                onChange={(e) => setImportMode(e.target.value as 'combine' | 'overwrite')}
                className="mr-2"
              />
              <span className="text-sm">
                <strong>Overwrite</strong> - Replace all existing data with imported data
              </span>
            </label>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!itemsFile || isProcessing}
          >
            {isProcessing ? 'Importing...' : 'Import'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}