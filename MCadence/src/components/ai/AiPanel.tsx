'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useAppState } from '@/lib/state';
import {
  PeriodSpec,
  InsightV1,
  buildInsightStats,
  generateInsight,
  getCachedInsight,
  clearCachedInsight,
  isAIEnabled,
  getAISource,
  loadAISettings,
  saveAISettings,
  isValidAPIKeyFormat,
  maskAPIKey,
  AISettings,
} from '@/lib/ai/insight';
import {
  getThisWeekRangeNY,
  getLast7DaysRangeNY,
  getCustomRangeNY,
  formatDateYMD,
  getNowNY,
} from '@/utils/date';
import { InsightCard } from './InsightCard';
import { QuickAddSection } from './QuickAddSection';
import { CleanupSection } from './CleanupSection';

// ============================================================================
// Tab Types
// ============================================================================

type AIFeatureTab = 'insight' | 'quickadd' | 'cleanup';

// ============================================================================
// Tab Navigation Component
// ============================================================================

interface TabNavProps {
  activeTab: AIFeatureTab;
  onTabChange: (tab: AIFeatureTab) => void;
}

function TabNav({ activeTab, onTabChange }: TabNavProps) {
  const tabs: { id: AIFeatureTab; label: string; icon: string }[] = [
    { id: 'insight', label: 'Insight', icon: '🔮' },
    { id: 'quickadd', label: 'Quick Add', icon: '✨' },
    { id: 'cleanup', label: 'Clean-up', icon: '🧹' },
  ];
  
  return (
    <div className="flex border-b border-gray-200 mb-4">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors relative ${
            activeTab === tab.id
              ? 'text-primary-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <span className="flex items-center justify-center gap-1.5">
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </span>
          {activeTab === tab.id && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600"></span>
          )}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// Period Selector Component
// ============================================================================

type PeriodOption = 'this_week' | 'last_7_days' | 'custom';

interface PeriodSelectorProps {
  selected: PeriodOption;
  onSelect: (option: PeriodOption) => void;
  customStart: string;
  customEnd: string;
  onCustomStartChange: (value: string) => void;
  onCustomEndChange: (value: string) => void;
}

function PeriodSelector({
  selected,
  onSelect,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange,
}: PeriodSelectorProps) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Analysis Period
      </label>
      <div className="flex flex-wrap gap-2 mb-3">
        <button
          onClick={() => onSelect('this_week')}
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
            selected === 'this_week'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          This Week
        </button>
        <button
          onClick={() => onSelect('last_7_days')}
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
            selected === 'last_7_days'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Last 7 Days
        </button>
        <button
          onClick={() => onSelect('custom')}
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
            selected === 'custom'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Custom
        </button>
      </div>
      
      {selected === 'custom' && (
        <div className="flex gap-3 items-center">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Start</label>
            <input
              type="date"
              value={customStart}
              onChange={(e) => onCustomStartChange(e.target.value)}
              max={customEnd || formatDateYMD(getNowNY())}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <span className="text-gray-400 mt-5">→</span>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">End</label>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => onCustomEndChange(e.target.value)}
              min={customStart}
              max={formatDateYMD(getNowNY())}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// AI Settings Component
// ============================================================================

interface AISettingsPanelProps {
  settings: AISettings;
  onSave: (settings: Partial<AISettings>) => void;
  onClose: () => void;
}

function AISettingsPanel({ settings, onSave, onClose }: AISettingsPanelProps) {
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [model, setModel] = useState(settings.model || 'gpt-4o-mini');
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    if (apiKey && !isValidAPIKeyFormat(apiKey)) {
      setError('Invalid API key format. OpenAI keys should start with "sk-"');
      return;
    }
    
    onSave({
      apiKey,
      model,
      enabled: apiKey.length > 0
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setError(null);
  };

  const handleClear = () => {
    setApiKey('');
    onSave({ apiKey: '', enabled: false });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="bg-gray-50 rounded-lg p-4 mb-4 border border-gray-200">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-gray-900 flex items-center gap-2">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          AI Settings
        </h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      {/* API Key Input */}
      <div className="mb-3">
        <label className="block text-sm text-gray-600 mb-1">OpenAI API Key</label>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            className="w-full px-3 py-2 pr-20 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700"
          >
            {showKey ? 'Hide' : 'Show'}
          </button>
        </div>
        {settings.apiKey && (
          <p className="text-xs text-gray-500 mt-1">
            Current: {maskAPIKey(settings.apiKey)}
          </p>
        )}
      </div>
      
      {/* Model Selection */}
      <div className="mb-3">
        <label className="block text-sm text-gray-600 mb-1">Model</label>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        >
          <option value="gpt-4o-mini">GPT-4o Mini (Recommended)</option>
          <option value="gpt-4o">GPT-4o</option>
          <option value="gpt-4-turbo">GPT-4 Turbo</option>
          <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Faster)</option>
        </select>
      </div>
      
      {/* Error Message */}
      {error && (
        <p className="text-sm text-red-600 mb-3">{error}</p>
      )}
      
      {/* Success Message */}
      {saved && (
        <p className="text-sm text-green-600 mb-3">✓ Settings saved</p>
      )}
      
      {/* Info */}
      <div className="text-xs text-gray-500 mb-3 p-2 bg-gray-100 rounded">
        <p className="mb-1">💡 Your API key is stored locally in your browser and sent directly to OpenAI. It is never stored on our servers.</p>
        <p>Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">OpenAI Platform</a>.</p>
      </div>
      
      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          className="flex-1 px-3 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 transition-colors"
        >
          Save Settings
        </button>
        {settings.apiKey && (
          <button
            onClick={handleClear}
            className="px-3 py-2 text-red-600 text-sm border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
          >
            Clear Key
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Loading State Component
// ============================================================================

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mb-4"></div>
      <p className="text-gray-600">Analyzing...</p>
      <p className="text-xs text-gray-400 mt-1">Computing stats from your data</p>
    </div>
  );
}

// ============================================================================
// Error State Component
// ============================================================================

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div className="text-4xl mb-4">⚠️</div>
      <p className="text-red-600 font-medium mb-2">Something went wrong</p>
      <p className="text-sm text-gray-500 mb-4 text-center max-w-xs">{message}</p>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
      >
        Retry
      </button>
    </div>
  );
}

// ============================================================================
// Empty State Component
// ============================================================================

interface EmptyStateProps {
  onGenerate: () => void;
  isLoading: boolean;
  aiEnabled: boolean;
}

function EmptyState({ onGenerate, isLoading, aiEnabled }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div className="text-5xl mb-4">🔮</div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">AI Insight</h3>
      <p className="text-sm text-gray-500 text-center mb-4 max-w-xs">
        Get personalized insights based on your tracked activities and goals.
      </p>
      <button
        onClick={onGenerate}
        disabled={isLoading || !aiEnabled}
        className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 font-medium"
      >
        Generate Insight
      </button>
      {!aiEnabled && (
        <p className="text-xs text-amber-600 mt-3 text-center">
          ⚠️ AI is not enabled. Configure your API key in Settings to use Insight.
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Insight Tab Content
// ============================================================================

interface InsightTabProps {
  aiEnabled: boolean;
}

function InsightTab({ aiEnabled }: InsightTabProps) {
  const { state } = useAppState();
  
  // Period selection state
  const [periodOption, setPeriodOption] = useState<PeriodOption>('this_week');
  const [customStart, setCustomStart] = useState(() => {
    const now = getNowNY();
    return formatDateYMD(now.subtract(7, 'day'));
  });
  const [customEnd, setCustomEnd] = useState(() => formatDateYMD(getNowNY()));
  
  // Generation state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insight, setInsight] = useState<InsightV1 | null>(null);
  const [fromCache, setFromCache] = useState(false);
  
  // Get current period spec
  const period = useMemo((): PeriodSpec => {
    let range;
    let label: string;
    
    switch (periodOption) {
      case 'this_week':
        range = getThisWeekRangeNY();
        label = 'this_week';
        break;
      case 'last_7_days':
        range = getLast7DaysRangeNY();
        label = 'last_7_days';
        break;
      case 'custom':
        range = getCustomRangeNY(customStart, customEnd);
        label = `${customStart.replace(/-/g, '')}_to_${customEnd.replace(/-/g, '')}`;
        break;
    }
    
    return {
      label: label as PeriodSpec['label'],
      startISO: range.startISO,
      endISO: range.endISO,
      timezone: 'America/New_York',
    };
  }, [periodOption, customStart, customEnd]);
  
  // Check for cached insight on period change
  useEffect(() => {
    const cached = getCachedInsight(period);
    if (cached) {
      setInsight(cached);
      setFromCache(true);
      setError(null);
    }
  }, [period]);
  
  // Generate insight
  const handleGenerate = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const stats = buildInsightStats(period, state);
      const result = await generateInsight(stats, { forceRefresh });
      
      setInsight(result.insight);
      setFromCache(result.fromCache);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate insight');
    } finally {
      setIsLoading(false);
    }
  }, [period, state]);
  
  // Handle regenerate (force refresh)
  const handleRegenerate = useCallback(() => {
    clearCachedInsight(period);
    handleGenerate(true);
  }, [period, handleGenerate]);
  
  // Handle period change
  const handlePeriodChange = useCallback((option: PeriodOption) => {
    setPeriodOption(option);
    setInsight(null);
    setFromCache(false);
    setError(null);
  }, []);
  
  return (
    <>
      {/* Period Selector */}
      <PeriodSelector
        selected={periodOption}
        onSelect={handlePeriodChange}
        customStart={customStart}
        customEnd={customEnd}
        onCustomStartChange={setCustomStart}
        onCustomEndChange={setCustomEnd}
      />
      
      {/* Content */}
      {isLoading ? (
        <LoadingState />
      ) : error && !insight ? (
        <ErrorState message={error} onRetry={() => handleGenerate(false)} />
      ) : insight ? (
        <InsightCard
          insight={insight}
          fromCache={fromCache}
          onRegenerate={handleRegenerate}
          isRegenerating={isLoading}
        />
      ) : (
        <EmptyState
          onGenerate={() => handleGenerate(false)}
          isLoading={isLoading}
          aiEnabled={aiEnabled}
        />
      )}
    </>
  );
}

// ============================================================================
// Main AI Panel Component
// ============================================================================

interface AiPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AiPanel({ isOpen, onClose }: AiPanelProps) {
  // Tab state
  const [activeTab, setActiveTab] = useState<AIFeatureTab>('insight');
  
  // Settings state
  const [showSettings, setShowSettings] = useState(false);
  const [aiSettings, setAiSettings] = useState<AISettings>(() => loadAISettings());
  const [aiEnabled, setAiEnabled] = useState(() => isAIEnabled());
  
  // Refresh AI enabled status when settings change
  useEffect(() => {
    setAiEnabled(isAIEnabled());
  }, [aiSettings]);
  
  // Handle settings save
  const handleSaveSettings = useCallback((newSettings: Partial<AISettings>) => {
    const updated = saveAISettings(newSettings);
    setAiSettings(updated);
    setAiEnabled(isAIEnabled());
  }, []);
  
  // Reset state when closing
  const handleClose = useCallback(() => {
    setShowSettings(false);
    onClose();
  }, [onClose]);
  
  // Get AI status info
  const aiSource = getAISource();
  const getStatusText = () => {
    if (aiSource === 'user') return 'AI enabled (your key)';
    if (aiSource === 'env') return 'AI enabled (server)';
    return 'AI disabled (configure API key)';
  };
  
  // Get modal title based on active tab
  const getModalTitle = () => {
    switch (activeTab) {
      case 'insight':
        return 'AI Insight';
      case 'quickadd':
        return 'Quick Add with AI';
      case 'cleanup':
        return 'Clean-up with AI';
    }
  };
  
  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={getModalTitle()} size="lg">
      <div className="max-h-[70vh] overflow-y-auto -mx-6 px-6">
        {/* AI Status Bar */}
        <div className="flex items-center justify-between mb-4 p-2 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2 text-sm">
            <span className={`w-2 h-2 rounded-full ${aiEnabled ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
            <span className="text-gray-600">{getStatusText()}</span>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
              showSettings
                ? 'bg-primary-100 text-primary-700'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </button>
        </div>
        
        {/* Settings Panel */}
        {showSettings && (
          <AISettingsPanel
            settings={aiSettings}
            onSave={handleSaveSettings}
            onClose={() => setShowSettings(false)}
          />
        )}
        
        {/* Tab Navigation */}
        <TabNav activeTab={activeTab} onTabChange={setActiveTab} />
        
        {/* Tab Content */}
        {activeTab === 'insight' && <InsightTab aiEnabled={aiEnabled} />}
        {activeTab === 'quickadd' && <QuickAddSection aiEnabled={aiEnabled} />}
        {activeTab === 'cleanup' && <CleanupSection aiEnabled={aiEnabled} />}
      </div>
    </Modal>
  );
}

export default AiPanel;
