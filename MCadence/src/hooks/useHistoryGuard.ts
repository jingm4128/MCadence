'use client';

import { useEffect, useRef, useCallback } from 'react';

/**
 * History state marker for the app guard
 */
const APP_GUARD_STATE = { mcadence_guard: true };

/**
 * Check if the current history state is our guard state
 */
function isGuardState(state: unknown): boolean {
  return typeof state === 'object' && state !== null && 'mcadence_guard' in state;
}

/**
 * Check if the current history state is a modal state
 */
function isModalState(state: unknown): boolean {
  return typeof state === 'object' && state !== null && 'mcadence_modal' in state;
}

/**
 * Hook to prevent accidental exit from the app via browser Back button.
 * 
 * Behavior:
 * 1. On first entry into the app (from external), inserts a guard history state
 * 2. First Back press stays in app (returns to guard state)
 * 3. Second Back press (from guard state) will exit normally
 * 4. After any in-app navigation, normal Back behavior is restored
 * 
 * @param enabled - Whether the guard is active (default: true)
 */
export function useHistoryGuard(enabled: boolean = true) {
  const guardInsertedRef = useRef(false);
  const initialHistoryLengthRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    // Store initial history length to detect external entry
    if (initialHistoryLengthRef.current === 0) {
      initialHistoryLengthRef.current = window.history.length;
    }

    // Only insert guard if we haven't already and this looks like an external entry
    const shouldInsertGuard = () => {
      // Don't insert if already done
      if (guardInsertedRef.current) return false;
      
      // Check if current state is already our guard or modal state
      if (isGuardState(window.history.state) || isModalState(window.history.state)) {
        guardInsertedRef.current = true;
        return false;
      }

      // Check if we're coming from external (no referrer or different origin)
      const isExternal = !document.referrer || 
        new URL(document.referrer).origin !== window.location.origin;
      
      // Insert guard if coming from external or if this is a fresh entry
      return isExternal || window.history.length <= 2;
    };

    if (shouldInsertGuard()) {
      // Insert a guard state that will catch the first Back press
      window.history.pushState(APP_GUARD_STATE, '', window.location.href);
      guardInsertedRef.current = true;
    }

    // Handle popstate (browser Back/Forward)
    const handlePopState = (event: PopStateEvent) => {
      // If we landed on the guard state, the user pressed Back
      // and we've now "absorbed" that Back press - they're still in the app
      if (isGuardState(event.state)) {
        // User is now at the guard state
        // Next Back will exit (or go to previous page)
        // We don't need to do anything special here
        return;
      }

      // If state has modal info, that's handled by useModalHistory
      // Normal navigation continues
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [enabled]);

  /**
   * Call this when the user performs intentional in-app navigation.
   * After this, normal Back behavior is appropriate.
   */
  const markUserNavigation = useCallback(() => {
    // After user navigates, guard has served its purpose
    guardInsertedRef.current = true;
  }, []);

  return { markUserNavigation };
}

/**
 * Type for modal identifiers
 */
export type ModalId = 
  | 'menu' 
  | 'export' 
  | 'clear' 
  | 'import' 
  | 'categories' 
  | 'ai'
  | string;

/**
 * Modal history state structure
 */
interface ModalHistoryState {
  mcadence_modal: ModalId;
  timestamp: number;
}

/**
 * Create a modal history state
 */
function createModalState(modalId: ModalId): ModalHistoryState {
  return {
    mcadence_modal: modalId,
    timestamp: Date.now(),
  };
}

/**
 * Get the modal ID from history state
 */
export function getModalFromState(state: unknown): ModalId | null {
  if (isModalState(state)) {
    return (state as ModalHistoryState).mcadence_modal;
  }
  return null;
}

/**
 * Hook to manage modal state with browser history.
 * 
 * When a modal opens, a history entry is pushed.
 * When the user presses Back, the modal closes.
 * 
 * @param modalId - Unique identifier for this modal
 * @param isOpen - Current open state of the modal
 * @param onClose - Callback to close the modal
 */
export function useModalHistory(
  modalId: ModalId,
  isOpen: boolean,
  onClose: () => void
) {
  const hasOpenedRef = useRef(false);
  const closingFromPopstateRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (isOpen && !hasOpenedRef.current) {
      // Modal just opened - push history state
      hasOpenedRef.current = true;
      const modalState = createModalState(modalId);
      window.history.pushState(modalState, '', window.location.href);
    } else if (!isOpen && hasOpenedRef.current) {
      // Modal is closing
      hasOpenedRef.current = false;
      
      // If not closing due to popstate, we need to go back in history
      if (!closingFromPopstateRef.current) {
        // Check if current state is our modal state before going back
        const currentModal = getModalFromState(window.history.state);
        if (currentModal === modalId) {
          window.history.back();
        }
      }
      closingFromPopstateRef.current = false;
    }
  }, [isOpen, modalId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = (event: PopStateEvent) => {
      // If modal is open and we got a popstate, close the modal
      if (hasOpenedRef.current) {
        // Check if we're navigating away from our modal state
        const currentModal = getModalFromState(event.state);
        if (currentModal !== modalId) {
          closingFromPopstateRef.current = true;
          onClose();
        }
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [modalId, onClose]);
}

/**
 * Combined hook for managing multiple modals with history
 */
export function useAppHistory() {
  const { markUserNavigation } = useHistoryGuard(true);
  
  return {
    markUserNavigation,
  };
}
