import React from 'react';
import { TabId } from '@/lib/types';
import { Header } from './Header';
import { TabBar } from '@/components/ui/TabBar';

interface LayoutProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  onMenuClick: () => void;
  onAIClick?: () => void;
  children?: React.ReactNode;
}

export function Layout({ activeTab, onTabChange, onMenuClick, onAIClick, children }: LayoutProps) {
  const getTabTitle = (tab: TabId): string => {
    switch (tab) {
      case 'dayToDay':
        return 'Day to Day';
      case 'hitMyGoal':
        return 'Hit My Goal';
      case 'spendMyTime':
        return 'Spend My Time';
      default:
        return 'mcadence';
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <Header
        title={getTabTitle(activeTab)}
        onMenuClick={onMenuClick}
        onAIClick={onAIClick}
      />
      
      <main className="flex-1 overflow-y-auto pb-20">
        <div className="p-4 safe-area-padding">
          {children}
        </div>
      </main>
      
      <TabBar activeTab={activeTab} onTabChange={onTabChange} />
    </div>
  );
}
