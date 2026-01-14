'use client';

import { TAB_CONFIG } from '@/lib/constants';
import type { TabId } from '@/lib/types';

interface TabBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  const tabs = [
    { id: 'dayToDay' as TabId, label: TAB_CONFIG.dayToDay.label, icon: TAB_CONFIG.dayToDay.icon },
    { id: 'hitMyGoal' as TabId, label: TAB_CONFIG.hitMyGoal.label, icon: TAB_CONFIG.hitMyGoal.icon },
    { id: 'spendMyTime' as TabId, label: TAB_CONFIG.spendMyTime.label, icon: TAB_CONFIG.spendMyTime.icon },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 mobile-tab-bar">
      <div className="flex justify-around items-center py-2 safe-area-padding">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex flex-col items-center justify-center px-3 py-2 rounded-lg transition-all tap-target ${
              activeTab === tab.id
                ? 'text-primary-600 bg-primary-50 border border-primary-200 shadow-sm scale-105'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span className={`text-xl mb-1 ${activeTab === tab.id ? 'scale-110' : ''}`}>{tab.icon}</span>
            <span className={`text-xs font-medium ${activeTab === tab.id ? 'font-semibold' : ''}`}>{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
