'use client';

import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
};

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />
        
        {/* Modal panel */}
        <div className={`relative w-full ${sizeClasses[size]} transform rounded-lg bg-white p-6 shadow-xl transition-all`}>
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 focus:outline-none"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          {/* Title */}
          {title && (
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              {title}
            </h2>
          )}
          
          {/* Content */}
          <div className="text-gray-700">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = false
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <p className="mb-6">{message}</p>
      <div className="flex justify-end gap-3">
        <button
          onClick={onClose}
          className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          {cancelText}
        </button>
        <button
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className={`px-4 py-2 rounded-lg transition-colors ${
            danger
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'bg-primary-600 text-white hover:bg-primary-700'
          }`}
        >
          {confirmText}
        </button>
      </div>
    </Modal>
  );
}

// Delete dialog for recurring items - allows choosing between deleting one occurrence or all future occurrences
interface RecurrenceDeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onDeleteOne: () => void;
  onDeleteAll: () => void;
  title: string;
  itemName?: string;
  seriesCount?: number;
}

export function RecurrenceDeleteDialog({
  isOpen,
  onClose,
  onDeleteOne,
  onDeleteAll,
  title,
  itemName,
  seriesCount = 0,
}: RecurrenceDeleteDialogProps) {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        <p className="text-gray-600">
          {itemName ? (
            <>This is a recurring item: <span className="font-medium text-gray-800">{itemName}</span></>
          ) : (
            'This is a recurring item.'
          )}
        </p>
        <p className="text-gray-600">What would you like to delete?</p>
        
        <div className="space-y-3 pt-2">
          {/* Delete this occurrence option */}
          <button
            onClick={() => {
              onDeleteOne();
              onClose();
            }}
            className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <div>
              <div className="font-medium text-gray-900">Delete this occurrence only</div>
              <div className="text-sm text-gray-500">Keep the recurring series, just remove this one</div>
            </div>
          </button>
          
          {/* Delete all future occurrences option */}
          <button
            onClick={() => {
              onDeleteAll();
              onClose();
            }}
            className="w-full flex items-center gap-3 p-3 border border-red-200 rounded-lg hover:bg-red-50 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div>
              <div className="font-medium text-red-700">Delete all occurrences</div>
              <div className="text-sm text-gray-500">
                Stop this recurring series completely
                {seriesCount > 0 && ` (${seriesCount} item${seriesCount > 1 ? 's' : ''})`}
              </div>
            </div>
          </button>
        </div>
        
        {/* Cancel button */}
        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
