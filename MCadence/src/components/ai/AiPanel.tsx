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
} from '@/lib/ai/insight';
import {
  AIProvider,
  PROVIDERS,
  PROVIDER_LIST,
  getProviderConfig,
  validateAPIKeyForProvider,
  maskAPIKey,
} from '@/lib/ai/providers';
import {
  loadUserSettings,
  saveUserSettings,
  resetUserSettings,
  getEffectiveSettings,
  setUserProvider,
  setUserApiKey,
  setUserModel,
  getEnvDefaultProvider,
  hasEnvDefaultKey,
  canUseDefaultKey,
  UserAISettings,
  EffectiveAISettings,
} from '@/lib/ai/settings';
import { getDefaultModel } from '@/lib/ai/providers';
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
// AI Settings Component - Multi-Provider Support with Long Press to Edit
// ============================================================================

type EditingField = 'provider' | 'apiKey' | 'model' | null;

interface AISettingsPanelProps {
  userSettings: UserAISettings;
  effectiveSettings: EffectiveAISettings;
  onProviderChange: (provider: AIProvider | null) => void;
  onApiKeyChange: (apiKey: string) => void;
  onModelChange: (provider: AIProvider, model: string) => void;
  onReset: () => void;
  onClose: () => void;
}

// Long press hook for settings items
function useLongPress(callback: () => void, delay: number = 500) {
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const isLongPress = React.useRef(false);

  const start = React.useCallback(() => {
    isLongPress.current = false;
    timeoutRef.current = setTimeout(() => {
      isLongPress.current = true;
      callback();
    }, delay);
  }, [callback, delay]);

  const stop = React.useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  return {
    onMouseDown: start,
    onMouseUp: stop,
    onMouseLeave: stop,
    onTouchStart: start,
    onTouchEnd: stop,
  };
}

function AISettingsPanel({
  userSettings,
  effectiveSettings,
  onProviderChange,
  onApiKeyChange,
  onModelChange,
  onReset,
  onClose,
}: AISettingsPanelProps) {
  const [apiKey, setApiKey] = useState(userSettings.apiKey);
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [editingField, setEditingField] = useState<EditingField>(null);

  const envDefaultProvider = getEnvDefaultProvider();
  const hasDefaultKey = hasEnvDefaultKey();
  
  const currentProvider = effectiveSettings.provider;
  const providerConfig = getProviderConfig(currentProvider);
  const currentModel = effectiveSettings.model;
  
  // Check if user can use the default API key
  const canUseDefault = canUseDefaultKey(currentProvider, currentModel);

  // Long press handlers for each field
  const providerLongPress = useLongPress(() => setEditingField('provider'));
  const apiKeyLongPress = useLongPress(() => setEditingField('apiKey'));
  const modelLongPress = useLongPress(() => setEditingField('model'));

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === 'default') {
      onProviderChange(null);
    } else {
      onProviderChange(value as AIProvider);
    }
    setError(null);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setEditingField(null);
    }, 500);
  };

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onModelChange(currentProvider, e.target.value);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setEditingField(null);
    }, 500);
  };

  const handleSaveKey = () => {
    if (apiKey && !validateAPIKeyForProvider(apiKey, currentProvider)) {
      setError(`Invalid API key format for ${providerConfig.name}. Expected format: ${providerConfig.apiKeyPlaceholder}`);
      return;
    }
    
    onApiKeyChange(apiKey);
    setSaved(true);
    setError(null);
    setTimeout(() => {
      setSaved(false);
      setEditingField(null);
    }, 500);
  };

  const handleClearKey = () => {
    setApiKey('');
    onApiKeyChange('');
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setEditingField(null);
    }, 500);
  };

  const handleReset = () => {
    setApiKey('');
    onReset();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setApiKey(userSettings.apiKey); // Reset API key to saved value
    setError(null);
  };

  // Get display text for provider
  const getProviderDisplayText = () => {
    if (userSettings.provider) {
      return PROVIDERS[userSettings.provider].name;
    }
    return `Default (${PROVIDERS[envDefaultProvider].name})`;
  };

  // Get display text for model
  const getModelDisplayText = () => {
    const model = providerConfig.models.find(m => m.id === currentModel);
    return model ? model.name : currentModel;
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

      {/* Hint text */}
      <p className="text-xs text-gray-400 mb-3">Long press on any item to edit</p>
      
      {/* Provider Selection */}
      <div className="mb-3">
        <label className="block text-sm text-gray-600 mb-1">AI Provider</label>
        {editingField === 'provider' ? (
          <div className="space-y-2">
            <select
              value={userSettings.provider || 'default'}
              onChange={handleProviderChange}
              autoFocus
              className="w-full px-3 py-2 border border-primary-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
            >
              <option value="default">
                Default ({PROVIDERS[envDefaultProvider].name})
                {hasDefaultKey ? ' ✓' : ''}
              </option>
              {PROVIDER_LIST.map(provider => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleCancelEdit}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div
            {...providerLongPress}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white cursor-pointer hover:bg-gray-50 select-none"
          >
            <span className="text-gray-800">{getProviderDisplayText()}</span>
            {canUseDefault && (
              <span className="text-xs text-green-600 ml-2">✓ using default key</span>
            )}
          </div>
        )}
      </div>
      
      {/* API Key */}
      <div className="mb-3">
        <label className="block text-sm text-gray-600 mb-1">
          {providerConfig.name} API Key
          {canUseDefault && (
            <span className="text-xs text-gray-400 ml-2">(optional)</span>
          )}
        </label>
        {editingField === 'apiKey' ? (
          <div className="space-y-2">
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSaveKey();
                  } else if (e.key === 'Escape') {
                    handleCancelEdit();
                  }
                }}
                placeholder={providerConfig.apiKeyPlaceholder}
                autoFocus
                className="w-full px-3 py-2 pr-20 border border-primary-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700"
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
            {error && (
              <p className="text-xs text-red-600">{error}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleSaveKey}
                className="px-3 py-1.5 bg-primary-600 text-white text-xs rounded-lg hover:bg-primary-700 transition-colors"
              >
                Save
              </button>
              {userSettings.apiKey && (
                <button
                  onClick={handleClearKey}
                  className="px-3 py-1.5 text-gray-600 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Clear
                </button>
              )}
              <button
                onClick={handleCancelEdit}
                className="px-3 py-1.5 text-gray-500 text-xs hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div
            {...apiKeyLongPress}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white cursor-pointer hover:bg-gray-50 select-none"
          >
            {userSettings.apiKey ? (
              <span className="text-gray-800">{maskAPIKey(userSettings.apiKey)}</span>
            ) : (
              <span className="text-gray-400 italic">
                {canUseDefault ? 'Using default key' : 'Not configured'}
              </span>
            )}
          </div>
        )}
      </div>
      
      {/* Model Selection */}
      <div className="mb-3">
        <label className="block text-sm text-gray-600 mb-1">Model</label>
        {editingField === 'model' ? (
          <div className="space-y-2">
            <select
              value={currentModel}
              onChange={handleModelChange}
              autoFocus
              className="w-full px-3 py-2 border border-primary-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
            >
              {providerConfig.models.map(model => (
                <option key={model.id} value={model.id}>
                  {model.name} {model.description ? `(${model.description})` : ''}
                </option>
              ))}
            </select>
            <button
              onClick={handleCancelEdit}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div
            {...modelLongPress}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white cursor-pointer hover:bg-gray-50 select-none"
          >
            <span className="text-gray-800">{getModelDisplayText()}</span>
          </div>
        )}
      </div>
      
      {/* Success Message */}
      {saved && (
        <p className="text-sm text-green-600 mb-3">✓ Settings saved</p>
      )}
      
      {/* Info */}
      <div className="text-xs text-gray-500 mb-3 p-2 bg-gray-100 rounded">
        <p className="mb-1">
          💡 Your API key is stored locally and sent directly to the AI provider. It is never stored on our servers.
        </p>
        <p>
          Get your API key from{' '}
          <a
            href={providerConfig.apiKeyHelpUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-600 hover:underline"
          >
            {providerConfig.name}
          </a>.
        </p>
      </div>
      
      {/* Reset Action */}
      {userSettings.hasUserOverride && (
        <div className="flex justify-end">
          <button
            onClick={handleReset}
            className="px-3 py-2 text-amber-600 text-sm border border-amber-200 rounded-lg hover:bg-amber-50 transition-colors"
            title="Reset to default provider and clear API key"
          >
            Reset All
          </button>
        </div>
      )}
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
  effectiveSettings: EffectiveAISettings;
}

function InsightTab({ aiEnabled, effectiveSettings }: InsightTabProps) {
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
  const [userSettings, setUserSettings] = useState<UserAISettings>(() => loadUserSettings());
  const [effectiveSettings, setEffectiveSettings] = useState<EffectiveAISettings>(() => getEffectiveSettings());
  
  // Refresh effective settings when user settings change
  useEffect(() => {
    setEffectiveSettings(getEffectiveSettings());
  }, [userSettings]);
  
  // Handle provider change
  const handleProviderChange = useCallback((provider: AIProvider | null) => {
    const updated = setUserProvider(provider);
    setUserSettings(updated);
  }, []);
  
  // Handle API key change
  const handleApiKeyChange = useCallback((apiKey: string) => {
    const updated = setUserApiKey(apiKey);
    setUserSettings(updated);
  }, []);
  
  // Handle model change
  const handleModelChange = useCallback((provider: AIProvider, model: string) => {
    const updated = setUserModel(provider, model);
    setUserSettings(updated);
  }, []);
  
  // Handle reset to defaults
  const handleReset = useCallback(() => {
    resetUserSettings();
    setUserSettings(loadUserSettings());
  }, []);
  
  // Reset state when closing
  const handleClose = useCallback(() => {
    setShowSettings(false);
    onClose();
  }, [onClose]);
  
  // Get status text
  const getStatusText = () => {
    const { source, provider } = effectiveSettings;
    const providerName = PROVIDERS[provider].name;
    
    if (source === 'user') {
      return `${providerName} (your key)`;
    } else if (source === 'env') {
      return `${providerName} (default)`;
    }
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
            <span className={`w-2 h-2 rounded-full ${effectiveSettings.enabled ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
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
            userSettings={userSettings}
            effectiveSettings={effectiveSettings}
            onProviderChange={handleProviderChange}
            onApiKeyChange={handleApiKeyChange}
            onModelChange={handleModelChange}
            onReset={handleReset}
            onClose={() => setShowSettings(false)}
          />
        )}
        
        {/* Tab Navigation */}
        <TabNav activeTab={activeTab} onTabChange={setActiveTab} />
        
        {/* Tab Content */}
        {activeTab === 'insight' && (
          <InsightTab aiEnabled={effectiveSettings.enabled} effectiveSettings={effectiveSettings} />
        )}
        {activeTab === 'quickadd' && <QuickAddSection aiEnabled={effectiveSettings.enabled} />}
        {activeTab === 'cleanup' && <CleanupSection aiEnabled={effectiveSettings.enabled} />}
      </div>
    </Modal>
  );
}

export default AiPanel;
