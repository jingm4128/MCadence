'use client';

import { useState, useRef, useCallback, ReactNode } from 'react';

interface SwipeableItemProps {
  children: ReactNode;
  onSwipeLeft?: () => void;  // Delete action
  onSwipeRight?: () => void; // Archive action
  leftLabel?: string;
  rightLabel?: string;
  leftColor?: string;  // Tailwind bg class for left swipe (delete)
  rightColor?: string; // Tailwind bg class for right swipe (archive)
  threshold?: number;  // Minimum swipe distance to trigger action (in pixels)
  disabled?: boolean;
}

export function SwipeableItem({
  children,
  onSwipeLeft,
  onSwipeRight,
  leftLabel = 'Delete',
  rightLabel = 'Archive',
  leftColor = 'bg-red-500',
  rightColor = 'bg-blue-500',
  threshold = 80,
  disabled = false,
}: SwipeableItemProps) {
  const [translateX, setTranslateX] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const startXRef = useRef<number | null>(null);
  const currentXRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return;
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = translateX;
    setIsTransitioning(false);
  }, [disabled, translateX]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (disabled || startXRef.current === null) return;
    
    const currentX = e.touches[0].clientX;
    const diff = currentX - startXRef.current;
    
    // Limit the swipe distance
    const maxSwipe = 120;
    const newTranslate = Math.max(-maxSwipe, Math.min(maxSwipe, diff));
    
    setTranslateX(newTranslate);
  }, [disabled]);

  const handleTouchEnd = useCallback(() => {
    if (disabled || startXRef.current === null) return;
    
    setIsTransitioning(true);
    
    if (translateX < -threshold && onSwipeLeft) {
      // Swiped left - Delete
      setTranslateX(-150);
      setTimeout(() => {
        onSwipeLeft();
        setTranslateX(0);
      }, 200);
    } else if (translateX > threshold && onSwipeRight) {
      // Swiped right - Archive
      setTranslateX(150);
      setTimeout(() => {
        onSwipeRight();
        setTranslateX(0);
      }, 200);
    } else {
      // Reset position
      setTranslateX(0);
    }
    
    startXRef.current = null;
  }, [disabled, translateX, threshold, onSwipeLeft, onSwipeRight]);

  // Mouse events for desktop testing
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled) return;
    startXRef.current = e.clientX;
    currentXRef.current = translateX;
    setIsTransitioning(false);
    
    const handleMouseMove = (e: MouseEvent) => {
      if (startXRef.current === null) return;
      
      const diff = e.clientX - startXRef.current;
      const maxSwipe = 120;
      const newTranslate = Math.max(-maxSwipe, Math.min(maxSwipe, diff));
      
      setTranslateX(newTranslate);
    };
    
    const handleMouseUp = () => {
      setIsTransitioning(true);
      
      if (translateX < -threshold && onSwipeLeft) {
        setTranslateX(-150);
        setTimeout(() => {
          onSwipeLeft();
          setTranslateX(0);
        }, 200);
      } else if (translateX > threshold && onSwipeRight) {
        setTranslateX(150);
        setTimeout(() => {
          onSwipeRight();
          setTranslateX(0);
        }, 200);
      } else {
        setTranslateX(0);
      }
      
      startXRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [disabled, translateX, threshold, onSwipeLeft, onSwipeRight]);

  const showLeftAction = translateX < -20;
  const showRightAction = translateX > 20;

  return (
    <div 
      ref={containerRef}
      className="relative overflow-hidden rounded-lg"
    >
      {/* Background actions */}
      <div className="absolute inset-0 flex">
        {/* Left side - Archive (shown when swiping right) */}
        <div 
          className={`flex-1 flex items-center justify-start pl-4 ${rightColor} transition-opacity ${
            showRightAction ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <span className="text-white text-sm font-medium flex items-center gap-1">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            {rightLabel}
          </span>
        </div>
        {/* Right side - Delete (shown when swiping left) */}
        <div 
          className={`flex-1 flex items-center justify-end pr-4 ${leftColor} transition-opacity ${
            showLeftAction ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <span className="text-white text-sm font-medium flex items-center gap-1">
            {leftLabel}
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </span>
        </div>
      </div>
      
      {/* Swipeable content */}
      <div
        className={`relative ${isTransitioning ? 'transition-transform duration-200' : ''}`}
        style={{ transform: `translateX(${translateX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
      >
        {children}
      </div>
    </div>
  );
}
