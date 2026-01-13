'use client';

import { useState } from 'react';
import { AppState } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

interface ImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: { state: AppState; mode: 'combine' | 'overwrite' }) => void;
}

export function ImportExportModal({ isOpen, onClose, onImport }: ImportExportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<'combine' | 'overwrite'>('combine');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type === 'application/json' || selectedFile.name.endsWith('.json')) {
        setFile(selectedFile);
        setError(null);
      } else {
        setError('Please select a valid JSON backup file');
        setFile(null);
      }
    }
  };

  const handleImport = async () => {
    if (!file) {
      setError('Please select a backup file');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      // Validate the imported state structure
      if (!parsed || !Array.isArray(parsed.items) || !Array.isArray(parsed.actions)) {
        throw new Error('Invalid backup file format. Expected a mcadence backup file with items and actions.');
      }

      const importedState: AppState = {
        items: parsed.items || [],
        actions: parsed.actions || [],
        categories: parsed.categories || [] // Categories are included in the full backup
      };

      onImport({ state: importedState, mode: importMode });
      onClose();
      
      // Reset form
      setFile(null);
      setImportMode('combine');
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError('Invalid JSON file. Please select a valid mcadence backup file.');
      } else {
        setError(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setError(null);
    setImportMode('combine');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Import Data">
      <div className="space-y-4">
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            Select a <strong>mcadence-backup-*.json</strong> file that was exported from this app.
            This will import all items, actions, and categories.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Backup File (JSON)
          </label>
          <input
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {file && (
            <p className="mt-1 text-sm text-green-600">✓ Selected: {file.name}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Import Mode
          </label>
          <div className="space-y-2">
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                value="combine"
                checked={importMode === 'combine'}
                onChange={(e) => setImportMode(e.target.value as 'combine' | 'overwrite')}
                className="mr-3 w-4 h-4 text-blue-600"
              />
              <span className="text-sm">
                <strong>Combine</strong> – Merge with existing data (keeps both)
              </span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                value="overwrite"
                checked={importMode === 'overwrite'}
                onChange={(e) => setImportMode(e.target.value as 'combine' | 'overwrite')}
                className="mr-3 w-4 h-4 text-blue-600"
              />
              <span className="text-sm">
                <strong>Overwrite</strong> – Replace all existing data
              </span>
            </label>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!file || isProcessing}
          >
            {isProcessing ? 'Importing...' : 'Import'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
