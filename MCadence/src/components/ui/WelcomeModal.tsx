'use client';

import { useState, useRef } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { AppState } from '@/lib/types';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: { state: AppState; mode: 'overwrite' }) => void;
  onStartFresh: () => void;
}

export function WelcomeModal({ isOpen, onClose, onImport, onStartFresh }: WelcomeModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        categories: parsed.categories || []
      };

      onImport({ state: importedState, mode: 'overwrite' });
      onClose();
      
      // Reset form
      setFile(null);
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

  const handleStartFresh = () => {
    onStartFresh();
    onClose();
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Welcome to MCadence">
      <div className="space-y-5">
        {/* Welcome Message */}
        <div className="text-center">
          <div className="text-4xl mb-3">👋</div>
          <p className="text-gray-600 text-sm">
            MCadence stores your data locally in your browser. If you have a previous backup,
            you can import it now to restore your items.
          </p>
        </div>

        {/* Info Box */}
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800">
            <strong>Note:</strong> Data stored in your browser won&apos;t survive if you clear your browser
            data or switch to a different device. We recommend regular backups.
          </p>
        </div>

        {/* Import Section */}
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
          <h3 className="font-medium text-gray-900 mb-2">Restore from Backup</h3>
          <p className="text-xs text-gray-500 mb-3">
            Select a <code className="bg-gray-200 px-1 rounded">mcadence-backup-*.json</code> file
          </p>
          
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="hidden"
          />
          
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={handleBrowseClick}
              className="flex-1"
              disabled={isProcessing}
            >
              {file ? `✓ ${file.name}` : 'Browse...'}
            </Button>
            <Button
              onClick={handleImport}
              disabled={!file || isProcessing}
            >
              {isProcessing ? 'Importing...' : 'Import'}
            </Button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-200"></div>
          <span className="text-xs text-gray-400 uppercase">or</span>
          <div className="flex-1 h-px bg-gray-200"></div>
        </div>

        {/* Start Fresh Button */}
        <Button
          variant="secondary"
          onClick={handleStartFresh}
          className="w-full"
          disabled={isProcessing}
        >
          Start Fresh
        </Button>

        <p className="text-xs text-gray-400 text-center">
          You can import data later from the menu (≡ → Import Data)
        </p>
      </div>
    </Modal>
  );
}
